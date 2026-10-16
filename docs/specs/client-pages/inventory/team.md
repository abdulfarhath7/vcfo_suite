# Client pages · Team · Announcements · Notifications · Audit · Settings — rebuild inventory

Catalogue of the FINAL clickable prototype for the five client "team" pages, mapped to the real Next.js app (`/home/user/vcfo_suite`). Written so a developer can rebuild each page with real data, matching the prototype pixel for pixel.

## 0. Sources, conventions, rules

### 0.1 Files (all paths relative to `docs/specs/client-pages/prototype/final-src/`)

| Abbrev | File | What it is |
|---|---|---|
| TR | `s/team/team_redesign.dc.html` | Team page (live board, has state) |
| TI | `s/team/team_invite.dc.html` | Team + "Invite a colleague" pop-up (static) |
| TH | `s/team/team_handoff.dc.html` | Team + "Hand off your seat" pop-up (static) |
| AR | `s/team/ann_redesign.dc.html` | Announcements page (props `tab` 0-2, `empty`) |
| AD | `s/team/ann_detail.dc.html` | Announcements + detail pop-up (static) |
| AE | `s/team/ann_empty.dc.html` | Announcements, `tab=1 empty=true` (Important filter empty) |
| NR | `s/team/notif_redesign.dc.html` | Notifications page (props `tab` 0-5, `allRead`, `drill` ""/0-4) |
| ND | `s/team/notif_drill.dc.html` | Notifications, `drill=1` (donut drill-down, Documents preselected) |
| NE | `s/team/notif_empty.dc.html` | Notifications, `tab=1 allRead=true` (all caught up) |
| UR | `s/team/audit_redesign.dc.html` | Audit page (props `tab` 0-4, `openId`, `drillDay` ""/13/12/11/10) |
| UD | `s/team/audit_drill.dc.html` | Audit, `drillDay=10` (day drill-down, Mon 5 Oct) |
| UF | `s/team/audit_filtered.dc.html` | Audit, `tab=1 openId=2` (Documents filter, details open) |
| SR | `s/team/settings_redesign.dc.html` | Settings page (props `section` 0-3, `pwOpen`, `waOff`, `waDialog`, `toast`) |
| SP | `s/team/settings_password.dc.html` | Settings, `section=1 pwOpen=true` (change password open) |
| SW | `s/team/settings_whatsapp.dc.html` | Settings, `section=2 waOff=true waDialog=true` (turn on WhatsApp) |
| TB | `s/team/topbar.dc.html` | Top bar component (props `crumb`, `mid`, `notif`, `active` ""/ann/notif, `legacy`) |
| SD | `s/team/side.dc.html` | Board sidebar placeholder (props `active` 0-8, `updates`) — replaced at runtime by shell.js |
| LA | `s/team/launcher.dc.html` | Board Ask VCFO launcher — hidden at runtime by proto.js (`hideBoardBots`) |
| MN | `s/team/Main.dc.html` | Canvas index: change table, "other improvements" list, owner decisions |
| CSS | `b/ecdc4c28c4511de8452c7a5f1e7f79e6.css` | The ONLY stylesheet these boards link. Already ported verbatim (scoped to `.cp`) at `src/components/client-portal/css/10-base.css` |
| PJ | `proto.js` | Prototype glue: theme, routing, toasts, tooltips, Ask VCFO launcher + chat, fallback feedback |
| SJ | `shell.js` | Shared sidebar / rail / drawer, breakpoints, Before/After pill |
| SUP | `s/docs/support.js` (aliased `team/support.js`) | React 18 + the "dc-runtime" (`<x-dc>`, `<sc-for>`, `<sc-if>`, `<dc-import>`, `DCLogic`). No page-specific behaviour or CSS in it; the boards only use it to render `{{…}}` templates. `.info` pop-overs open by CSS `:focus-within` only (no JS). |
| `*_current` | `team_current`, `ann_current`, `notif_current`, `audit_current`, `settings_current` | The app as it is today (used below only to list features that must be kept or that were deliberately dropped) |

Line numbers in `file:line` refer to the real files. The responsive contract (`<style>` lines 13-55) is byte-identical in TR, AR, NR, UR and SR, so `TR:13-55` = `AR:13-55` = and so on.

The prototype route map (`routes.js`): `team → s/team/team_redesign.dc.html`, `announcements → ann_redesign`, `notifications → notif_redesign`, `audit → audit_redesign`, `settings → settings_redesign`. **None of the five has a separate mobile (`m`) file.** Phone and tablet are the same boards reflowed by the CSS contract (§1.7, §3.2).

Real app routes (unchanged, rule 1 "keep routes"): `/app/client/team`, `/app/client/announcements`, `/app/client/notifications`, `/app/client/audit`, `/app/client/settings` (`app/app/client/*/page.tsx`, rendering `src/views/client/ClientTeam.tsx`, `src/views/announcements/AnnouncementsPage.tsx`, `src/views/notifications/NotificationHistoryPage.tsx`, `src/views/admin/AuditLog.tsx`, `src/views/settings/AccountSettings.tsx`).

### 0.2 Owner rules that bind these pages

- DECISIONS.md "Team, Updates, Audit, Settings": **only the Primary contact can invite**; **email cannot be turned off for documents, steps, deadlines and timeline**; it is optional for news (announcements + official feed) and the weekly summary; **SBC staff appear in the client Audit by name and role, with no emails and no internal metadata**; **invite = set-password link** (temporary password until the link ships); **Announcements and Notifications stay two pages** (no merge).
- DECISIONS.md "Shared": mobile drill-downs = bottom sheet; icons = Lucide 2 px glyph in a 32 px pale tile (notification icons, option 4); Before/After is a sliding toggle in the top bar.
- DESIGN-RULES.md: no explanation text under titles (use an (i) pop-over ending in "Ask VCFO about this"); navy sliding pill with spring; buttons 6 px radius, badges 4 px, cards ≤ 12 px; rule 14 (hover tooltip + click drill-down with the clicked part preselected); rule 16 (the bot speaks in empty states); rule 17 (icons explain themselves, 120 ms navy tooltip); rule 18 (set A solid status glyphs); motion respects `prefers-reduced-motion`.
- Main board "Other improvements" (MN:54-64): #1 announcement read state on the server (M); #2 audit shows client-safe events only (M); #3 audit download PDF/CSV (S); #4 invite by set-password link (**Approved**); #5 pending invite + Resend/Cancel (S); #6 notification preferences saved per user, new table (M); #7 WhatsApp quiet hours 9 pm–8 am (S); #8 sign out of other devices + last sign-in time (M); #9 notification row deep-links to the exact step or document (S); #10 merge Updates (Not now); #11 Messages thread (L, not designed).

### 0.3 Gaps, conflicts and things the boards leave out (read before building)

| # | Where | Finding | Recommendation |
|---|---|---|---|
| G1 | NR:151, NR:277-278 | `markAll` logic and the "All marked read · Undo" toast exist, but **no "Mark all read" control is rendered** in the FINAL board. MN:38 promises "Mark all read". | Add a `btn btn-g btn-sm` "Mark all read" at the right end of the notifications card header (`.tb-hd`, `margin-left:auto`); show it only when unread > 0. Wire it to the existing `markAllNotificationsRead`. |
| G2 | SR:199-200, SR:224 | Settings computes a 4-tab pill (Profile · Security · Notifications · Appearance) and `thumb`, but **the pill is not rendered**. MN:41 still describes it. The four sections are always visible (5/7 grid) and carry anchors `#profile #security #notifications #appearance`. | Build what is rendered: no pill. Support deep-link anchors (`/app/client/settings#notifications`, used by NR:145). |
| G3 | SR:221-222 | Greeting-card colour swatches (6) are computed but **not rendered**. The current app's "Greeting Card / Sidebar appearance" pickers are dropped on the client page. | Do not render swatches. Only Theme + Reduce motion. |
| G4 | SR:230, SR:235 | Turning WhatsApp off shows a toast with **Undo, but Undo only hides the toast** (does not turn WhatsApp back on). | Make Undo restore the previous state. |
| G5 | SR:227 | When WhatsApp is off the board shows the number as "Not set up". The real profile keeps `phoneE164` after an opt-out. | Show the number with an "Off" chip when a number exists; "Not set up" only when `phoneE164` is null. |
| G6 | TR:69 | The Invite button always carries the tooltip "Only the Primary contact can invite", even for the Primary. | Primary: enabled, tooltip optional. Member: disabled (`aria-disabled`), same tooltip. Server must enforce (§2.1). |
| G7 | TR:112 | The current user's row shows a gold chip that reads **"Northwind"** (`r.you`). It reads like a "You" marker. | Keep the gold chip but label it with the client's own short company name, exactly as the board does, or confirm "You" with the owner. |
| G8 | TR:117 vs TH | Every member row (including other members) has a "Substitute {name}" button, but only the self hand-off ("Hand off your seat") is designed. | Self → TH design. Another member → same dialog shell, title "Substitute {name}", no "you lose access" strip, button "Substitute" (navy). This keeps the existing feature (rule 1). |
| G9 | AR:150-152 | Prototype "General" = everything that is not Deadline/Compliance. The real `announcementMatchesFilter` (`src/lib/announcements.ts`) makes "general" = `kind === 'general'` only. | Follow the prototype counts (All 6 = Important 2 + General 4): change the lib, or update its test. |
| G10 | AR:69-75 | The Next-deadline banner always shows. Before COI, a client usually has no GST filings. | Show only when the client overview has an upcoming compliance item. Hide otherwise (no empty banner). |
| G11 | NR:153-174, UR:150-173 | Drill-downs use `.tb-ov.tb-top`, which on phones is a **centred dialog** (TR:45). DECISIONS "Mobile drill-downs = Bottom sheet". | On phones (≤767) render drill-downs as a bottom sheet (full width, radius 16 16 0 0, max-height 92dvh). Desktop/tablet as in the board. |
| G12 | UR:98 + CSS:19 | The 14-day bars animate with `@keyframes grow{from{transform:scaleX(0)}…}` (scaleX, a horizontal grow), even though `transform-origin:bottom`. | Replicate the CSS as is for parity, or use `scaleY` if the owner wants bars to rise. Flag to the owner. |
| G13 | PJ:661-667 (`tidyTips`) | At runtime the prototype **removes** tooltips whose text is "obvious": anything starting `WhatsApp|Call|Email|Teams|Phone|Message`, exactly `Close`, `Details`, `Open`, `Announcements`, `Search (⌘K)`, `Photo placeholder`, `Notifications`… So contact buttons, Close and Details show **no** tooltip in the prototype, but keep `aria-label`. All `title` attributes are removed. | Match the prototype: no tooltip on those, keep `aria-label`. |
| G14 | SR:139,148,149,152,159 | Toggles sit inside `<span data-tip>` wrappers and also have `aria-label`; the prototype can show both the CSS tooltip and the proto `#vp-tip` at once. | Show one tooltip only (the wrapper's). |
| G15 | All five | No before/after-incorporation variant exists for these pages (they do not listen to `vcfo-after`). Only the shell changes (Incorporation badge 6/14 → 14/14) and proto toasts "Showing the company after incorporation" (PJ:213-218). | No per-page variant. Real data decides content (e.g. G10). |
| G16 | TI, TH, AD | These pop-ups are separate static boards placed over the page with `.ov` (absolute). No click on the live page opens them in the prototype; the Invite button / row click / Substitute button fall back to a toast. | Build them as real dialogs opened by those controls; use the `.tb-ov` sizing rules (TR:33-35) so they fit the viewport. |
| G17 | Audit, Settings | Credentials audit rows come from `localStorage['vcfo.credsAudit']` (UR:202-203) in the prototype. | Real build: credentials reveal/copy must write `audit_events` (new action, e.g. `credentials.reveal`). |

---

## 1. INVENTORY

Columns: **id | item | exact behaviour | file:line**. Colours are CSS tokens from CSS:3-16 (light) and PJ:36-60 (dark, "True black").

### 1.0 Shared chrome (all five pages)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| SH-01 | Page frame | `.tb-root` flex row, min-height 100vh, bg `--bg`, Manrope 13 px, `--fg`. Left: sidebar placeholder `.tb-side` width `var(--vp-side-w)` (248 desktop / 72 tablet / 0 phone), bg `#0f2a4a`. Right: `.tb-main` flex 1. Content `<main class="pg tb-wrap">`: width 100%, **max-width 1600 px, centred**, padding `clamp(16px,2vw,24px)` sides/top and **96 px bottom** (phone: `16px 16px 104px`), flex column, gap 16. | TR:15-22, CSS:121, TR:38-40 |
| SH-02 | Breakpoints | phone ≤ 767 px · tablet 768-1279 px (72 px icon rail) · desktop ≥ 1280 px. shell.js sets `<html data-vp-bp>` and `--vp-side-w` and fires `vcfo:bp`. Extra page breakpoints: 959 (grids stack, top-bar search becomes an icon), 520 (notification kind chip), 700/760 (proto bar, `.pg` padding). | TR:14-17, SJ:28-37, TB:31-46 |
| SH-03 | Top bar | `<header class="tbar">` 52 px, sticky (pinned by `pinNav`, z 40), bottom border, bg white/90 % (dark 13 %/90 %) with `backdrop-filter:saturate(1.4) blur(10px)`. Left: SBC logo (26 px high, tooltip "SBC home" below — suppressed G13) → Home. Location trail: 24 px icon tile (primary-light) + `Home / [mid /] crumb`; current item 600 weight, ellipsis. Right group gap 6: Search button (256 px; 196 px ≤1279; 36 px icon only ≤959; 40 px borderless icon on phone) with "Search" + ⌘ K kbd; Announcements icon button 36 px; Notifications icon button 36 px with count badge; Theme button (bordered, hidden on phone). | TB:15-69 |
| SH-04 | Top bar per page | Team: crumb "Team". Announcements: mid "Updates", crumb "Announcements", Announcements button active (bg `--primary-light`, colour `--primary`) and its gold dot hidden. Notifications: mid "Updates", crumb "Notifications", Notifications button active, badge = live unread count. Audit: crumb "Audit". Settings: crumb "Settings". | TR:66, AR:67, NR:82, UR:86, SR:85, TB:76-85 |
| SH-05 | Announcements button | 36×36, radius 8, no border; megaphone (duo fill .26). **Gold 8 px dot** top 6 right 6 with 2 px panel ring when there are unread announcements and the page is not Announcements. Click → `/app/client/announcements`. | TB:64, PJ:231 |
| SH-06 | Notifications button | 36×36 bell (duo). Badge `.tbar-badge`: absolute top 3 right 3, min-width 16, height 16, radius 99, bg `--primary-fill`, white 700 11 px, ring 2 px panel. Hidden when count 0. Click → `/app/client/notifications`. | TB:30, TB:65 |
| SH-07 | Theme button | Sun icon 16 px, 36×36, 1 px border, bg panel, muted. Label/tooltip "Switch to dark theme" / "Switch to light theme" (kept in sync, `aria-pressed`). Click toggles light ↔ dark; stored (`vcfo.theme`). Hidden on phone (theme lives in Settings › Appearance and the drawer). | TB:66, PJ:7-35 |
| SH-08 | Phone menu button | Phone only: 40×40 hamburger at the far left (`data-vp-menu`), logo + trail icon + "Home /" hidden, crumb 15 px 700. Click opens the shell drawer. | TB:37-46, TB:51, TB:85 |
| SH-09 | Before / After pill | Shell inserts a 168×32 two-segment pill (navy thumb, `.42s cubic-bezier(.22,1.2,.36,1)`) in the desktop top bar before Announcements; inside the rail on tablet; at the top of the drawer on phone. Switching on these pages only toasts "Showing the company after/before incorporation". | SJ:12-13, SJ:215-225, SJ:540-546, PJ:213-218 |
| SH-10 | Sidebar (production = shell.js) | Navy sidebar replaces the board placeholder. Items: Home · **Updates ▸** (Announcements, Notifications badge "3" hot) · Incorporation (badge 6/14, 14/14 after COI) · **Compliances ▸** (Calendar, Filings) · Documents (badge 6) · Library · Credentials · Team · Audit · Settings. Then "Northwind’s team" (Priya Raman · Project Manager, Arjun Mehta · Project Lead, Customer support · SBC help desk) with WhatsApp/Call/Email/Teams hover actions; account row (RK, "Rahul Khanna", "Northwind · Client") with a Sign out icon button (tooltip "Sign out"); account menu items Settings / Help · Ask VCFO / Sign out. Tablet: 72 px icon rail with tooltips and fly-outs. Phone: drawer. Active item: navy glass pill + 3 px rail, spring .42 s. | SJ:91-110, SJ:275-306 |
| SH-11 | Sidebar (board placeholder) | Board version for reference: Home, Updates (red count chip), Incorporation 7/14, Compliances, Documents 6, Library, Team, Audit; team block with 40 px avatars and 32×30 contact buttons; account row (active on Settings, `active=8` hides the pill). Active pill moves `translateY(index*38px)`. | SD:16-99 |
| SH-12 | Ask VCFO launcher | One global launcher fixed bottom-right (`#vp-launch`): character gripping the bottom edge (20.5 s loop) + navy pill "Ask VCFO" (36 px, 40 px phone) with teal dot. Character ducks while scrolling, while chat is open or when over a control. Board launchers (LA, `.tb-launch` at top 870) are hidden at runtime. Chat opens above the pill (desktop) / bottom sheet (phone). | PJ:314-480, PJ:622-633, LA:16-19 |
| SH-13 | "Ask VCFO why" / "Ask VCFO about this" | Any link with that text opens the chat; "…about this" pre-asks "Tell me about <nearest heading>". | PJ:233, PJ:249-255 |
| SH-14 | Icon tooltips (CSS) | `[data-tip]` hover/focus-visible: navy bubble above (`bottom:calc(100% + 9px)`), white 700 11.5/1.25 px, padding 5×9, radius 6, nowrap, z 70, shadow, 8 px rotated-square arrow; `tipin .12s`. `[data-tip-below]` puts it under. Reduced motion: no animation. | CSS:165-173 |
| SH-15 | Icon tooltips (JS) | Icon-only `a/button` with `aria-label` and no `data-tip` (and not "obvious", G13) get `#vp-tip` (navy, 12 px 700, 5×9, radius 6) after **120 ms**, placed 32 px above (or 6 px below near the top), clamped 8 px from the edges; hides on pointerdown/scroll. | PJ:295-311, PJ:133-134 |
| SH-16 | Toast (global) | `#vp-toast`: fixed, centred, bottom 64 px (100 px under 700 px wide), navy, white 600 13 px, radius 8, padding 10 12 10 14, max-width min(560, 100vw − 32). Optional "Undo" button (gold `#e6c46e` text on white/14 %). In: opacity .18 s + translate .22 s `cubic-bezier(.22,1,.36,1)`. Auto-hide after **3200 ms**. Undo → callback then toast "Undone". | PJ:130-132, PJ:159-167 |
| SH-17 | Toast (page) | `.toast.tb-toast` (Notifications, Settings): fixed, bottom 24 px, centred on the main column (`left:calc(50% + var(--vp-side-w)/2)`), navy, gap 12, z 61; link "Undo" in `oklch(86% 0.09 85)`. Phone: centred on the screen, bottom 96 px. | CSS:152-153, TR:36, TR:46 |
| SH-18 | Fallback feedback | In the prototype any control without its own behaviour toasts after 380 ms: download → "Download started · …"; copy → "Link copied"; WhatsApp/Call/Email/Teams → "Opening …"; portal/↗ → "Opens the official portal in a new tab"; approve/submit/send/save/mark/confirm/request/remind/resend/cancel invite/hand off/turn on/turn off → "<label> · done" **with Undo**; search → "Search · type to find…"; external `https:` links → "Opens … in the full app". Use these as the intended success messages. | PJ:237-247, PJ:257-292 |
| SH-19 | Page transitions | Enter: `body` `vpIn .26s cubic-bezier(.22,1,.36,1)` (opacity 0 → 1, translateY 6 → 0). Leave: opacity .35 over .14 s, then navigate after 140 ms. Team main also staggers children (`.stag>*` `v7fade .2s`). Cards: `up .5s cubic-bezier(.2,.7,.2,1) backwards`. | PJ:110-118, PJ:135-137, CSS:20, CSS:93-95 |
| SH-20 | Card hover | `.card:hover` translateY(-2 px), border `oklch(54.6% 0.215 263 / .35)`, layered shadow, `.16s cubic-bezier(.22,1,.36,1)`. `.card.t` = 38×3 gold tab at top-left (left 18). | CSS:20-22, CSS:80-82 |
| SH-21 | Sliding pill (`.seg`) | Track: padding 2, radius 8, `light-dark(oklch(96.5% .008 250), oklch(18.3% .008 250))`, inset 1 px border. Thumb: absolute top/bottom/left 2, radius 5, **navy** (dark: `--navy-3`), `transition: transform .42s linear(…spring…)`; width `calc((100% - 4px)/N)`, moved by `translateX(index*100%)`. Buttons 28 px (40 px phone), padding 0 10, radius 5, 500 12 px, colour `oklch(55% .022 255)` → hover darker; active white. Counts `.cnt` IBM Plex Mono 11 px (`html .seg .cnt`), active `oklch(100% 0 0 / .72)`. On phones wrapped in `.tb-segx` (horizontal scroll, no scrollbar). | CSS:61-79, TR:24-26, TR:30, TR:51 |
| SH-22 | Toggle (`.tgl`) | 38×22, radius 6, off bg `light-dark(oklch(86% .012 255), oklch(34.2% .012 255))`, on bg navy; knob 16×16 radius 4 at 3/3, on = translateX(16 px), spring .42 s; bg .2 s; disabled opacity .45 + not-allowed. Phone: invisible hit area extended 9 px above/below. Dark: knob stays light. | CSS:136-139, TR:52-53, PJ:51 |
| SH-23 | (i) pop-over (`.info`) | 18×18 button, colour `oklch(62% .02 255)` → navy on hover/focus. Pop: absolute under the icon (+8 px), 200-280 px wide, padding 10×12, radius 8, panel, 1 px border, shadow, 500 12/1.45 px, arrow; fades/slides in .15 s on `:focus-within` (click focuses the button). Ends with "🤖 Ask VCFO about this" row (border-top, primary 700). Phone: 40×40 hit area. | CSS:108-116, TR:54 |
| SH-24 | Bot speech bubble (rule 16) | Flex row aligned to the bottom, centred, gap 10: bot avatar (`v7c_bot`, 48-52 px, state idle / answered) + bubble `role=status` max-width 300, panel, 1 px border, radius **10 10 10 3**, padding 10×12, shadow; first line `.rt` 700; optional `.cap`; actions row (gap 10, margin-top 8): `btn btn-o btn-sm` + text link 12 px "Ask VCFO why". | TR:101-107, AR:84-91, NR:91-97, UR:111-117 |
| SH-25 | Dialog anatomy | Scrim `.ov` `oklch(21% 0.042 264 / .42)`, flex centre. `.dlg` 460 px default (custom widths below), radius 12, big shadow, overflow hidden. `.dlg-h` flex gap 10 padding 16×18 bottom hairline; `.dlg-b` padding 16×18 column gap 12; `.dlg-f` right-aligned gap 8 padding 12×18, top hairline, bg `--raised`. Live dialogs use `.tb-ov` (fixed, inset 0, z 60, padding 12, scrollable; `.tb-top` aligns to top at `min(120px,12vh)` on desktop, centred on phone); `.dlg` max-width `100vw − 24`, max-height `100dvh − top − 12`. Close = borderless `.ibtn` with ✕ 16 px. | CSS:145-149, TR:33-35, TR:45 |
| SH-26 | Buttons | `.btn` 36 px, padding 0 14, radius 6, 600 13 px, press scale .98 (.12 s). `.btn-n` navy → `--navy-2` hover; `.btn-o` panel + border; `.btn-g` transparent → raised hover; `.btn-sm` 30 px, 0 10, 12 px; `.ibtn` 32×30, radius 6, 1 px border, muted → navy-ink + tinted border on hover; `.wa` green fill. Phone: `.btn`/`.btn-sm` 40 px, `.ibtn` 40×40. Focus ring 2 px `oklch(54.6% .215 263 / .4)` offset 2. | CSS:34-37, CSS:83-87, CSS:129-135, TR:49-50 |
| SH-27 | No text under 11 px | `.lbl` 11 px, `.seg .cnt` and `.kbd` 11 px, `.dtile .m` 11 px letter-spacing .06em on these pages. | TR:28-31 |
| SH-28 | No visible scrollbars | `scrollbar-width:none` everywhere; scrolling still works. | PJ:140-141 |
| SH-29 | Reduced motion | All animations and transitions off (`*{animation:none;transition:none}`), card hover lift off, stagger off, tooltips instant, launcher static. | CSS:67, CSS:105, CSS:116, CSS:162, CSS:173, PJ:151 |
| SH-30 | Dark theme | Tokens replaced by the "True black" set (bg #000, panel 13 %, navy → `oklch(46% .15 258)`, navy-ink near white…). Sidebar and `.tb-side` go black. Seg thumb uses `--navy-3`. | PJ:36-60 |

### 1.1 Team — `/app/client/team`

| id | item | exact behaviour | file:line |
|---|---|---|---|
| TM-01 | Page head | No H1 (the crumb is the title, rule 7). `.ph` row holds only the right-aligned actions. | TR:68-70, CSS:122-124 |
| TM-02 | **Invite** button | `btn btn-n` (navy, 36 px; 40 px phone) with user-plus icon 15 px + "Invite". Tooltip "Only the Primary contact can invite". Click → opens Invite pop-up (TM-14). Primary contact only (G6). | TR:69 |
| TM-03 | SBC team cards grid | `.tb-cards` grid `repeat(auto-fit,minmax(min(100%,250px),1fr))`, gap 16 → 3 across on desktop, 2 or 1 as width shrinks. One card per SBC person: Project Manager, Project Lead(s), then Customer support. Stagger-in (`.stag`). | TR:56, TR:72-91, TR:133-137 |
| TM-04 | SBC card | `article.card.t` padding 18, gap 14, gold top tab. Row: avatar 60×60 circle (initials, 700 18 px Space Grotesk, white) with ring `0 0 0 3px var(--panel), 0 0 0 5px <ring>` (gold for SBC staff, `--border` for support); `aria`/title "Photo placeholder" (real photo when available). Text: role chip (Project Manager / Project Lead: navy + white; Customer support: `--prog-light`/`--prog-text`); name 700 16 px navy-ink, margin-top 6; line mono 11 px muted, margin-top 2, `overflow-wrap:anywhere` (email; support: "support@sbc.in · +91 90597 90014"). | TR:74-82, TR:134-136 |
| TM-05 | SBC contact buttons | Grid of 4 equal columns, gap 8. Each `a.btn` height 38 (40 phone), padding 0, icon 17 px stroke 1.8: **WhatsApp** (`.wa` green fill, white), **Call** (`.btn-o`, navy-ink), **Email** (`.btn-o`, navy-ink), **Teams** (`.btn-o`, `light-dark(oklch(48% .14 280), oklch(80.8% .098 280))`). `aria-label` "WhatsApp {name}" / "Call {name}" / "Email {name}" / "Teams {name}"; tooltips suppressed (G13). Click: WhatsApp → `https://wa.me/<digits>`; Call → `tel:`; Email → `mailto:`; Teams → `https://teams.microsoft.com/l/chat/0/0?users=<email>` (all new tab except tel/mailto). Prototype toast "Opening WhatsApp Priya Raman…". | TR:83-88, PJ:242 |
| TM-06 | People card | `section.card` (no gold tab). Header `.tb-ph` (flex, gap 10, padding 14×16, wraps): violet `.ic` 30 px with users icon 15 px; `h2.h3` "People from Northwind" (13 px 700 navy-ink); pill pushed right. | TR:93-98, TR:58-59 |
| TM-07 | People filter pill | 4 tabs (`role=tablist`, `role=tab`): **All 4 · Primary 1 · Members 2 · Invited 1** (count = rows matching). Thumb `calc((100% - 4px)/4)`. Phone: pill takes a full-width row (`flex:1 1 100%`). Already-active tab click → proto toast "Already showing …". | TR:97, TR:144-147, TR:60, PJ:282 |
| TM-08 | People rows | List under a hairline. `.row` (flex, gap 12, padding 12×16, top hairline). Avatar 36 px initials 12 px (colour per person; pending invite = `--up` bg + `--fg` text). Name `.rt`. Current user: extra gold-soft/gold-text chip "Northwind" (G7). Email mono 11 px muted, one line, ellipsis. **Desktop**: role chip (Primary = navy/white · Member = raised/muted · Invite sent = due-light/due-text) + date column 110 px right-aligned mono 11.5 px muted ("Since 2 Sep", "Sent 6 Oct"). **Phone**: role chip moves next to the name, date moves under the email (mono 11 px). Actions column min-width 76, right-aligned, gap 6. | TR:109-120, TR:139-150 |
| TM-09 | Pending invite actions | Rows with status "Invite sent": two `.ibtn`: **Resend** (circular-arrows icon; label + tooltip "Resend invite to {email}") and **Cancel invite** (✕; tooltip "Cancel invite"). Resend → new link email, toast "Invite sent again · Undo"-style (proto "Resend invite to … · done" + Undo). Cancel → removes the row with toast + Undo (proto "Cancel invite · done" + Undo). | TR:116, PJ:244 |
| TM-10 | Substitute / hand off | Member and Primary rows: one `.ibtn` swap-arrows icon, label + tooltip "Substitute {name}". Own row → Hand-off pop-up (TM-15). Other row → substitute dialog (G8). | TR:117 |
| TM-11 | Empty filter state | When a tab has no rows: bot (idle, 48) + bubble, padding 32×16. Text "No pending invites." (Invited tab) or "No one here yet."; buttons **Invite** (`btn-o btn-sm`, same action as TM-02) and link "Ask VCFO why" (opens chat). | TR:100-108, TR:151 |
| TM-12 | Loading state (not drawn) | Boards draw no loader. Rule 12 + Incorporation decision: skeleton shown after 150 ms, held ≥ 300 ms. Use `.sk` shimmer (1.2 s linear) in the card/row shapes. | CSS:150-151, DECISIONS "Loading" |
| TM-13 | Card motion | Cards rise in (`up .5s`), stagger `.2s` steps; hover lift (SH-20). | CSS:20, CSS:95 |
| TM-14 | **Invite pop-up** | Dialog 460 px. Header: navy `.ic` user-plus + `h2` "Invite a colleague" (700 16 px navy-ink, `id=inv-t`, `aria-labelledby`) + Close. Body: 2-column grid gap 12: **Name** input, **Work email** input (`type=email`) (labels `.fl` 12 px 700). **Sign-in** block: label "Sign-in", bordered box (radius 8, padding 10×12) with navy link icon, "Set-password link by email" (`.rt`) + cap "Expires in 7 days", and `.ibtn` "Copy the link" (copy icon, tooltip). Role strip (bg raised, radius 8, padding 10×12): chip "Member" (raised/muted + inset border) + "Sees everything on Northwind. Cannot invite." (600 12 px). Footer: **Cancel** (`btn-g`) + **Send invite** (`btn-n`, paper-plane icon). Behaviour: validate email; Send → pending row appears under Invited (count +1), dialog closes, toast "Invite sent to {email}" + Undo (= cancel invite). Copy → copies the link, toast "Link copied" (only after the invite exists; before Send it should be disabled or create the invite first). Esc / scrim / ✕ / Cancel close. Until the set-password link ships, the box shows the temporary password instead (DECISIONS). | TI:17-46 |
| TM-15 | **Hand-off pop-up** | Dialog **500 px**. Header: `.ic` red (`--over-chip`) swap icon + "Hand off your seat" + Close. Body: (1) 3-column grid `1fr 28px 1fr` gap 10: **from** card (1 px border, radius 8, padding 10; avatar 34 px "RK" primary-fill; "Rahul Khanna" / cap "Primary · Northwind") → arrow 24 px in `--over` → **to** card (1.5 px **dashed** `--navy-3`, bg `--primary-light`; avatar 34 px navy initials from the typed name; name / cap "New Primary"). (2) Warning strip: bg `--over-light`, text `--over-text`, 700 12.5 px, radius 8, triangle icon: "You lose access to Northwind right after this." (3) Name + Work email (2 columns). (4) "Sign-in for {first name}" + set-password link box + Copy. (5) Checkbox 16 px, `accent-color:navy`: "I understand I will be signed out". Footer: Cancel (`btn-g`) + **Hand off & leave** (bg `--over-chip`, white). Behaviour: the "to" card mirrors the typed name live; submit enabled only when email valid and box ticked; on success the server replaces the user, emails both, and the client is signed out (toast "Handed off to {name}"). | TH:17-52 |
| TM-16 | Kept from current page | Current page: client list + inline invite form (Name optional, Email, Temporary password, "Add client to project") + per-row "⇄ Substitute" dialog (Replacement name/email/temporary password; "Hand off & leave" when replacing yourself). Redesign keeps invite + substitute, moves invite to a pop-up, adds SBC people, pending state, set-password link. | `team_current.dc.html`, `src/views/client/ClientTeam.tsx:181-363` |

### 1.2 Announcements — `/app/client/announcements`

| id | item | exact behaviour | file:line |
|---|---|---|---|
| AN-01 | Top bar | Home / Updates / **Announcements**; Announcements icon active, gold dot hidden. Sidebar: Updates ▸ Announcements. | AR:65-67, TB:81-83 |
| AN-02 | Next-deadline banner | `section.tb-focus`: flex, centre, gap 16, padding 14×18, radius 10, bg `--due-light`, border 1 px `oklch(66% 0.17 48 / .35)`. Date tile `.dtile` 50×54 bg `--due-chip` white: "20" (700 18 px Space Grotesk) / "OCT" (11 px uppercase). Text: `.lbl` in `--due-text` "Next deadline · in 12 days"; title 700 16 px `--fg` "GSTR-3B for September" (margin-top 3). Right: `a.btn.btn-o.btn-sm` **Open** → that filing (`/app/client/compliances/filings` with the item open). Hidden in the empty variant and when there is no upcoming deadline (G10). Phone: wraps, padding 12×14, Open pushed to the right edge. | AR:69-75, AR:61 |
| AN-03 | Layout grid | `.tb-g12` 12 columns, gap 16, align start. Latest card `span 8`; Official portals card `span 4`. ≤959 px both full width (portals below). | AR:56-60, AR:77 |
| AN-04 | Latest card header | `.tb-hd` (flex, gap 10, padding 12×16, bottom hairline, wraps): `h2.h3` "Latest" + pill pushed right (`aria-label="Filter announcements"`): **All 6 · Important 2 · General 4**. Phone: pill takes a full row. | AR:79-82, AR:58-59, TR:47 |
| AN-05 | Filter rules | Important = kind Deadline or Compliance. General = all others (G9). Counts from the loaded list. | AR:150-153 |
| AN-06 | Announcement row | Whole row is a link `a.row` (inherit colour/weight, no underline). Date tile 50×54: Deadline → bg `--due-light` text `--due-text`; others → bg `--primary-light`, text navy-ink. Middle: line 1 (flex wrap, gap 4×8): kind chip (Deadline `--due-chip`/white; Compliance `--prog-chip`/white; MCA/Tax/GST/Post-Incorp/others neutral: raised bg, navy-ink text, inset 1 px border), caption "From Priya Raman" or "Official feed", and on phone the source host chip; line 2 title `.rt` **14 px**, weight **800 if unread, 600 if read**, margin-top 4. Right (desktop): source host chip ("mca.gov.in", raised/muted + inset border). Far right: unread dot `.udot` 8 px `--primary-fill` (`role=img`, label + tooltip "Unread"). Unread row bg `light-dark(oklch(97.6% .014 260), oklch(16.6% .01 260))`. | AR:93-103, AR:155-161, CSS:140-144 |
| AN-07 | Row click | Prevent default, mark read (dot disappears, title to 600, tint removed, topbar gold dot updates), open Detail pop-up (AN-10) at that item. | AR:94, AR:160 |
| AN-08 | Empty filter state | Bot idle 52 + bubble, padding 56×16×64: "No important updates right now." + cap "Deadlines will show up here first." + **See all** (`btn-o btn-sm`, switches pill to All) + "Ask VCFO why". Shown when the active filter has no rows (AE: Important with no deadline/compliance items; banner hidden). | AR:83-92, AR:139, AR:166-167, AE |
| AN-09 | Official portals card | `section.card.t` span 4. Header (padding 14×16): navy `.ic` with bank icon + `h2.h3` "Official portals". Pill full width (2 columns) **Setup 8 · Recurring 4**. Groups (padding 0 16 14, gap 12): `.lbl` heading (Incorporation / Registrations / FEMA; Monthly / Quarterly) then rows: flex gap 8, padding 6 0, top hairline: name `.rt` flex 1; `.ibtn` **↗** (14 px arrow; label + tooltip "Open portal for {name}"; opens the official site in a new tab); `.ibtn` **circular** (document icon; "Read circular for {name}"; opens the circular in a new tab). | AR:106-126, AR:162-169 |
| AN-10 | **Detail pop-up** | Scrim aligned to the top (padding-top 140 px on the board; live: `.tb-ov.tb-top`). Dialog **560 px**. Header (align start): date tile (Deadline colours) + chips row ("Deadline" `--due-chip` white **min-width 116 px centred**; "Important" raised/muted) + `h2` 700 **18/1.3 px Space Grotesk** navy-ink, margin-top 6 + Close. Body 13.5/1.6 px: message paragraph; author strip (raised, radius 8, padding 10×12): avatar 30 px "PR", "Priya Raman" + cap "Project Manager · 8 Oct, 09:05", `.ibtn.wa` "WhatsApp Priya Raman", `.ibtn` "Email Priya Raman"; link "🤖 Ask VCFO about this" (bot 18 px, 12.5 px). Footer `space-between`: ‹ Previous / › Next `.ibtn` (tooltips "Previous announcement" / "Next announcement") + mono cap "1 / 6"; **Got it** (`btn-n`) closes. Prev/Next walk the current filtered list and mark each shown item read. For feed items: show source host + "Open on mca.gov.in ↗" instead of the author strip. | AD:17-41 |
| AN-11 | Kept from current page | Kind chips, "From …" attribution, live board updates (4 s head poll), firm-wide feed items, portal + circular links per task. Staff-only (not on client): compose, remove, RSS feed management. Current portals list (collapsible groups, "Portal ↗ Circular ↗" text links) becomes the compact card. | `ann_current.dc.html`, `src/views/announcements/AnnouncementsPage.tsx:242-432` |

### 1.3 Notifications — `/app/client/notifications`

| id | item | exact behaviour | file:line |
|---|---|---|---|
| NT-01 | Top bar + sidebar | Home / Updates / **Notifications**; Notifications icon active; badge = unread count (3). Sidebar Updates chip = unread count (red, `--over-chip`). Both update live when items are read. | NR:80-82, NR:269 |
| NT-02 | Layout grid | `.tb-g12`: list card `span 9`; side column `span 3` (flex column, gap 16). ≤959: list full width; side column becomes `repeat(auto-fit,minmax(min(100%,240px),1fr))` grid under it. | NR:56-58, NR:85 |
| NT-03 | Filter pill | Card header `.tb-hd` (no title): pill 6 tabs, `aria-label="Filter notifications"`, `aria-selected`: **All 11 · Unread 3 · Documents 2 · Steps 4 · Deadlines 1 · Messages 4**. Thumb `(100%-4px)/6`. Phone: horizontal scroll inside `.tb-segx`. (Add "Mark all read" at right, G1.) | NR:87-89, NR:234-235 |
| NT-04 | Groups | Day groups: **Today · Earlier this week · Earlier** (`.lbl` navy-ink, padding 12 16 6). Empty groups hidden. | NR:99-101, NR:238-243 |
| NT-05 | Row | `.row` (unread → tinted, `.row.unread`). (1) Icon tile `.nic` 32×32 radius 8, bg = type tint, glyph 18 px stroke 2 in the type colour, `role=img` + `aria-label` = type tooltip. (2) Text column: title link `a.rt.nt` (800 if unread / 600; hover `--primary` + underline offset 2) → item page; body line `.nb` (12 px muted, one line, ellipsis) made of parts joined by " · ", link parts `--primary` 600 (hover underline), external links open a new tab; phone: "who · time" line (mono 11 px) under the body. (3) Kind chip column `.nkind` **104 px** fixed (so chips align; ≤520 px: auto width, right-aligned). (4) Desktop "who · time" column `.tb-d` **168 px** right-aligned mono 11 px muted nowrap; who = link to Team for SBC people / colleagues (`.nwho` muted 500 → primary + underline on hover), plain text for "VCFO Suite"/"SBC". (5) Unread: `button.udot.pulse` 8 px (pulse 1.8 s gold ring), label "Unread · mark as read", click → marks read; read rows get an 8 px spacer. (6) `.ibtn` → arrow 15 px, label "Open {title}" → item page. | NR:103-115, NR:59-77, CSS:118 |
| NT-06 | Types (icon, chip, tooltip) | `doc` file-text · chip "Request" due-light/due-text · "Document request". `back` file-text · "Sent back" over-light/over-text · "Document sent back · fix needed". `step` circle-check · "Step" ok-light/ok-text · "Step done". `time` circle-check · "Timeline" prog-light/prog-text · "Timeline changed". `deadline` calendar-clock · "Deadline" amber `light-dark(oklch(96.8% .05 85), oklch(23.9% .12 85))` / `light-dark(oklch(45% .12 70), oklch(82% .084 70))` · "Deadline coming up". `mail` mail · "Email" sky-light/sky-chip · "Email sent to Northwind". `ann` megaphone · "Announcement" orange · "Announcement". `team` users · "Team" blue · "Team change". Filter groups: Documents = doc+back; Steps = step+time; Deadlines = deadline; Messages = mail+ann+team. Icon colours/tints: §3.6. | NR:186-213 |
| NT-07 | Demo rows (deep links, rule/idea #9) | Today: "2 documents requested" (Utility bill for the office → step 7, Board resolution → board resolution; Arjun Mehta 10:42, unread → Documents) · "Passport copy sent back" (reason text · "Open the document" → document viewer; 09:15, unread) · "GSTR-1 due in 3 days" (Sun 11 Oct · GST → Filings; "GST portal ↗" external; VCFO Suite 09:00) · "Phase 2 end date moved to 28 Oct" (Approved by Priya Raman → Team; See the timeline → Home; 08:30, unread → phase page). Earlier this week: "Capital Structure accepted" (Step 6 of 14 is complete → step 6) · "Name approved by MCA" (company name · Name approval letter → viewer) · "MCA V3 portal down 11–12 Oct" (Official feed → Announcements; mca.gov.in ↗) · "Email sent: Documents requested" (To rahul@… · Email settings → Settings). Earlier: "Meera Iyer joined the project" (Director · invited by Northwind → Team) · "DIN allotted to both directors" (names · Step 4 · DIN) · "Email sent: Welcome to VCFO Suite" (Open Home). | NR:214-226 |
| NT-08 | Mark one read | Dot click → read; counts update everywhere (Unread tab, topbar badge, sidebar chip). Opening the row (title/arrow) should also mark it read (current app does this). | NR:112, NR:241-242 |
| NT-09 | Mark all read + Undo | Sets every item read, shows page toast "All marked read" + **Undo** (restores the previous read set). Trigger missing in the board (G1). | NR:151, NR:277-278 |
| NT-10 | Empty — all caught up | Unread tab with nothing unread (NE): bot state **answered** 52 px wrapped in `.react` (`v7react .55s` pop) + bubble "All caught up. Nothing unread." + **See all** (switches to All). Same component for any empty filter. | NR:90-98, NR:279, NE |
| NT-11 | Donut card "This month" | `section.card.t` padding 16, gap 12, centred. `h2.st` "This month" (12 px 800 uppercase .07em). SVG 140×140 rotated −90°: track circle r 54 stroke 18 `--raised`; 4 segments in order Documents (`--due-chip`), Steps (`--prog-chip`), Deadlines (`oklch(70% 0.15 80)`), Messages (`--sky-chip`), each `stroke-dasharray = (len−2) (C−len+2)`, `stroke-dashoffset = −sum(previous)`, C = 2π·54. **Hover a segment** → its stroke-width 18 → **24** (`transition: stroke-width .15s`) + navy tooltip at the top centre "Steps · 4" (700 12 px, padding 4×9, radius 6, arrow). **Click a segment** → drill-down with that type preselected. Centre: round button inset 26 px, panel bg: total `metric` 30 px "11" + cap "this month"; hover → tooltip "All · 11"; click → drill-down on All. | NR:122-134, NR:246-264, NR:272-273 |
| NT-12 | Donut legend | 4 buttons (flex column gap 2): 10×10 swatch radius 3, label (600 12 px), mono count; padding 5×6, radius 6; hover/linked-hover bg `--raised` and highlights the matching segment; click → drill-down preselected. Phone min-height 40. | NR:135-137, NR:261-262, NR:62 |
| NT-13 | **Drill-down pop-up** | `.ov.tb-ov.tb-top`; dialog **600 px** column. Top strip `.dd-top` (bg `--primary-light`, bottom border, padding 9×18, 12 px muted, wraps): lead + right link 800 12.5 px: All → "These live in Northwind’s Notifications list" / "Show in the list ↓" (closes, then after 60 ms smooth-scrolls to y = 200); Documents → "These items live in Documents" / "Open Documents →"; Steps → "These steps live in Incorporation" / "Open Incorporation →"; Deadlines → "These deadlines live in Compliances · Filings" / "Open Filings →"; Messages → "These messages live in Announcements" / "Open Announcements →". Header: navy `.ic` bell + "Notifications this month" + Close. Pill (padding 12 18 0) 5 tabs **All 11 · Documents 2 · Steps 4 · Deadlines 1 · Messages 4**, clicked part preselected, `aria-label="Filter by type"`. List (padding 8 0 10, **max-height min(420px, 52dvh)**, scroll): `a.row` padding 10×18 → item page: icon tile, title `.rt` + mono cap "who · time", kind chip, primary arrow. Close: ✕, Esc, scrim. Phone: bottom sheet (G11). | NR:153-174, NR:265-275, ND |
| NT-14 | "Northwind gets these by" card | `section.card` padding 14×16 gap 10: `h2.h3`; chips "✓ Email" (prog-light/prog-text, padding 4×8) and "✓ WhatsApp" (ok-light/ok-text) — show only the channels that are on; link "Change in Settings →" (12 px) → `/app/client/settings#notifications`. | NR:139-146 |
| NT-15 | Dropped vs current | Current: date pill (All/Today/This week/Earlier) + direction pill (All/Received/Sent), row expands to show IST time, "Clear from inbox" ✕. Redesign: one type pill; day groups replace the date pill; sent emails appear as kind "Email" under Messages; row opens the item instead of expanding. History still includes items cleared from the bell inbox. | `notif_current.dc.html`, `NotificationHistoryPage.tsx:27-46,97-114` |

### 1.4 Audit — `/app/client/audit`

| id | item | exact behaviour | file:line |
|---|---|---|---|
| AU-01 | Top bar + sidebar | Home / **Audit**; sidebar Audit active. | UR:84-86 |
| AU-02 | Header actions | `.ph .acts` (right): search `label.tb-srch` (flex 0 1 240, width 240, min 150) with magnifier at left 10/top 10 (`--subtle`) and `input.inp` padding-left 32, placeholder "Search", `aria-label="Search the audit log"` — filters by action, subject, person. The board input has no handler; build: client-side filter over loaded rows, ~200 ms debounce. **Export** `btn btn-o` with download icon → downloads the filtered log (CSV; PDF optional, idea #3). Phone: actions take a full row, search flexes `1 1 150px`. | UR:88-93, UR:56, UR:78-79 |
| AU-03 | "Last 14 days" card | `section.card.t` padding 14 18 12, gap 10. Header: `h2.st` "Last 14 days", total `metric` 20 px pushed right ("20") + cap "events". Bars: 14-column grid gap 6 (3 on phone), height 64, items aligned to the bottom; each bar is a `button` (full height, transparent) containing a span with height `max(count×14, 3)` px, radius 3 3 0 0: today `--navy` opacity 1; days with events `--navy-3` opacity .55 (1 when hovered, `.15s`); empty days `--border`, button **disabled**. Grow-in `.9s cubic-bezier(.2,.7,.2,1)` (G12). Hover → navy tooltip above the bar, centred at `(i+.5)/14` of the width: "Thu 8 Oct · 3 events" / "· 1 event". Click (non-empty) → day drill-down. Labels row: 14-col grid, mono 11 px centred; today navy-ink 700, others `--subtle`. | UR:95-102, UR:220-241, UR:252 |
| AU-04 | Filters | `.tb-hd` with two pills: **type** (`aria-label="Filter by type"`) All · Documents · Milestones · Team · Email · Credentials, with counts that respect the "who" filter; **who** (`aria-label="Filter by who"`) Everyone · SBC · Northwind (no counts), pushed right (`margin-left:auto`). Wraps; phone: both full width, left-aligned. | UR:104-108, UR:205-210, UR:59, UR:69 |
| AU-05 | Day group | `.tb-day` grid `72px | 1fr`, gap 16, padding-top 14. Day header: date tile **60×62** (today navy/white; other days primary-light/navy) + weekday cap 700 centred under it ("Today", "Wed", "Tue"). Timeline rail `.tb-vl` 2 px `--border` at left 79 px (71 ≤959, 67 phone) from top 14 to bottom 14. Phone: header becomes a row (tile 50×52 + caption 12 px) above the events. | UR:119-123, UR:60-61, UR:70-73 |
| AU-06 | Event row | `.tb-ev` grid `52px 28px 1fr 190px 32px` gap 12, padding 8 0 (≤959: `48 28 1fr 150 32`, gap 10; phone: `44 28 1fr 40`, who moves to row 2 under the text). Cells: time mono 12 600 navy-ink; status node 28 px circle (white glyph stroke 2.6, set A; 3 px panel ring) with tooltip + `aria-label`; text: action 700 + muted " · subject"; who: avatar 24 px (11 px initials, no ring) + name 12 600 ellipsis + role chip (SBC: navy/white — "Lead", "Manager", "System"; client people: gold-soft/gold-text "Client"); **Details** `.ibtn` with chevron 14 px (`aria-expanded`, rotates 180° when open). | UR:126-131, UR:62, UR:66, UR:74-75 |
| AU-07 | Status nodes (rule 18) | req (person, amber `oklch(66% .17 55)`, filled glyph) "Waiting on Northwind" · back (!, `--over-chip`) "Sent back · fix needed" · up (trend arrow, blue `oklch(55% .2 262)`) "With SBC · to review" · ok (✓, green `oklch(58% .15 155)`) "Done" · time (blue) "With SBC · timeline" · mail (`--sky-chip`) "Email" · team (navy, user-plus) "Team change". | UR:185-187 |
| AU-08 | Details (expand) | One open at a time. `.tb-facts` under the row: margin `0 0 8px 92px` (86 ≤959, 0 phone), padding 12×14, radius 8, bg raised, grid 3 columns gap 10×16 (phone `auto-fit,minmax(120px,1fr)`): key `.lbl` / value `.rt` (wrap anywhere). Full-width CTA `a.btn.btn-o.btn-sm`: "Open request", "Upload again", "View timeline", "Preview file", "View email", "Open step", "Open Team", "Open Credentials" → the real page. Facts are plain language; **no emails or internal metadata** (decision). | UR:133-138, UR:192-201, UR:63-64, UF |
| AU-09 | Empty filter state | "Nothing matches these filters yet." + **Clear filters** (resets both pills to All/Everyone) + "Ask VCFO why"; padding 40×16×24. | UR:110-118, UR:250 |
| AU-10 | Load older | Centred `btn btn-o btn-sm` "Load older" after the list (padding-top 16) → next page (keyset cursor). Hide when no more. | UR:144 |
| AU-11 | **Day drill-down pop-up** | `.ov.tb-ov.tb-top`, dialog **760 px**. Top strip: "These events live in the Audit log" / "Show in the Audit log ↓" (closes, after 60 ms smooth-scrolls to y = 280). Header: date tile navy/white (day/month), `h2` 700 16 px "Mon, 5 Oct" ("Today, 8 Oct" for today) + cap "2 events" + Close. Pill of **days that have events, newest first**, with counts, buttons padding 0 8 (`aria-label="Pick a day"`), clicked day preselected. List max-height `min(420px,52dvh)`: `a.row` padding 10×18: time (44 px mono 12 600), node (no ring), text (action 700 · subject), desktop who (12 600) + role chip, primary ↗ icon; phone: who + role under the text. Phone: bottom sheet (G11). | UR:150-173, UR:242-258, UD |
| AU-12 | Demo data | Today (8 Oct): 10:42 Documents requested · Utility bill, Board resolution (Arjun Mehta, Lead) [Items 2 · Due 12 Oct · Step 4 · Registered office → Open request]; 09:15 Document sent back · Passport copy (Arjun) [Reason Photo page is blurred · Uploaded by Meera Iyer · File passport_meera.pdf → Upload again]; 08:30 Timeline change approved · Phase 2 ends 28 Oct (Priya Raman, Manager) [Before 24 Oct · After 28 Oct · Slipped 4 days]. Wed 7: 18:20 Document uploaded · Passport copy (Meera Iyer, Client); 16:05 Change request sent · Phase 2 +4 days (Northwind = RK, Client) [Reason Directors travelling · Asked 24 → 28 Oct · Status Approved]; 11:30 Email sent · Documents requested (VCFO Suite, System) [To Northwind · Delivered · Also sent WhatsApp nudge]. Tue 6: 15:10 Step accepted · Capital Structure (Priya) [Step 6 of 14 · Submitted 4 Oct · Turnaround 2 days]; 12:00 Colleague invited · Ananya Rao (Northwind) [Invited · Access Member · Status Invite sent]. Older days feed the bars and drill-down only. Total 20. | UR:192-232 |
| AU-13 | Dropped vs current | Current: "Global logs / By project" tabs, search + role select + type select, table When/What/Who (role pill + name + **email**)/Target (company + id hash)/▾ raw metadata. Redesign: one project, pills instead of selects, timeline by day, no emails, no ids, facts in plain words, 14-day chart, export. | `audit_current.dc.html`, `AuditLog.tsx:459-650` |

### 1.5 Settings — `/app/client/settings`

| id | item | exact behaviour | file:line |
|---|---|---|---|
| ST-01 | Top bar + sidebar | Home / **Settings**; sidebar account row highlighted (glass bg + inset ring), nav pill hidden. | SR:83-85, SD:93-95 |
| ST-02 | Layout | `.tb-g12`: left column `span 5` (flex column gap 16) = hero, Profile, Security; right `span 7` = Notifications, Appearance. ≤959: one column, in that order. Sections are anchors `#profile #security #notifications #appearance`. | SR:56-58, SR:88-164 |
| ST-03 | Identity hero | Section radius 10, padding 18, gradient `linear-gradient(115deg, navy-deep 0%, navy-2-deep 60%, navy-3-deep 100%)`, white, gap 16, 3 px gold fade line at the bottom. Avatar 72 px circle `--primary-fill`, initials 700 22 px Space Grotesk, ring 3 px white/25 %. **Change photo** button: absolute right −4 bottom −4, 28×28, radius 6, bg gold, navy camera icon 14 px, tooltip "Change photo" (phone hit area +6 px) → upload / remove photo menu. Text: name `metric` 22 px white; email mono 11 px .75 opacity; chips "Primary" (gold bg, navy text) or "Member", and company "Northwind Technologies" (white/14 %). | SR:90-94, SR:66 |
| ST-04 | Profile card | `section.card#profile`. Header `.ch` (padding 16 18 4): navy `.ic` person + `h2.h3` "Profile" + **Edit** (`btn-g btn-sm`, right) → inline edit form (name, email + current password, phone, WhatsApp number + consent), Save/Cancel. Rows `.kv` (grid `110px 1fr auto`, gap 10, padding 10 0, top hairline except first; key 12 px 700 muted): **Full name**; **Email** (mono 12) + (i) pop-over "Changing email needs your password. Sign-in moves to the new address." + Ask VCFO (pop anchored right: `left:auto;right:-8px;transform:none`); **Phone** (mono); **WhatsApp** (number or "Not set up") + chip "Verified" (ok-light/ok-text) or "Off" (raised/muted). Phone: key column 92 px. | SR:96-104, SR:75-77, SR:67 |
| ST-05 | Security card | `section.card#security`: navy `.ic` lock + "Security". Row **Password**: mono `••••••••` + cap "changed 2 Sep" (nowrap) + **Change** (`btn-o btn-sm`, hidden while the form is open). Row **This device**: "Chrome on Windows · Hyderabad" + chip "Active now" (ok). | SR:106-122 |
| ST-06 | Change-password form | Inline under the Password row (SP): form bg raised, radius 8, padding 12, gap 10, margin 4 0 8. Fields `.fl`: Current password (`autocomplete=current-password`), New password (`new-password`); strength meter = 4 bars (flex gap 4, height 5, radius 2; filled with `--ok` for strong; use due/over colours for weaker), `aria-label="Strength: strong"`; requirement chips "✓ 8+ characters", "✓ Number", "✓ Symbol" (ok-light/ok-text when met) + verdict chip "Strong" (`--ok-chip` white, min-width 116 centred); Confirm new password (border `--ok` when it matches). Buttons right: Cancel (`btn-g btn-sm`) + **Save password** (`btn-n btn-sm`). Save → closes form, toast "Password changed" (green check). Errors: wrong current password inline. | SR:109-118, SR:225-226, SP |
| ST-07 | Notifications card header | `section.card.t#notifications`: navy `.ic` bell + "Notifications" + (i) "Email is Northwind’s record and stays on for anything that needs action. WhatsApp is a quick nudge on top." + Ask VCFO about this. | SR:126-129 |
| ST-08 | Channel cards | `.tb-ch2` grid `auto-fit,minmax(min(100%,270px),1fr)` gap 12, padding 12 18 6 (phone 12). Each: flex gap 12 padding 12 radius 8 1 px border. **Email**: `.circ` 44 px `--prog-chip` mail icon 20; "Email" 800 + mono cap address; chip "Always on" (prog-light). **WhatsApp**: `.circ` `--ok` WhatsApp icon; "WhatsApp" 800 + mono cap number; on → `.tgl.on` (tooltip + label "WhatsApp is on · click to turn off"); off → card bg raised + **Turn on** `btn-n btn-sm`. | SR:130-142, SR:59, SR:227-230 |
| ST-09 | Preference matrix | Header `.mx` (grid `34px 1fr 84px 84px`, gap 12, padding 10×16, top hairline): blank, `.lbl` "Tell me when", "Email" (centred), "WhatsApp" (centred). 7 rows, icon `.ic` 30 px coloured: Documents requested or sent back (`--due-chip`) — Email **locked On** · WhatsApp on; Step accepted or needs changes (`--ok-chip`) — locked · on; Deadlines and reminders (`--over-chip`) — locked · on; Timeline changes (`--prog-chip`) — locked · on; Announcements from SBC (`--navy-3`) — Email toggle **on** · WhatsApp off; Official feed news (MCA, GST, Tax) (`--sky-chip`) — Email **off** · WhatsApp off; Weekly summary · Monday 9 am (`--violet-chip`) — Email **on** · WhatsApp "—" (no WhatsApp). Locked cell = chip with lock icon 11 px + "On" (raised/muted + inset border), tooltip "Always on · email is Northwind’s record". Toggles: tooltip/label "Email on · {row}" / "WhatsApp off · {row}"; when WhatsApp is off all WhatsApp toggles are disabled with tooltip "Turn on WhatsApp first". The board only flips local state (no toast); build: save each change at once (optimistic, revert on error). Phone: icon column hidden, columns `1fr 60px 76px`, gap 10, padding 10×12. | SR:143-151, SR:196-219, SR:78, SR:68-69 |
| ST-10 | Quiet hours row | Last `.mx` row, bg raised, radius 0 0 10 10: `.ic` `--navy-2` moon + "Quiet hours · no WhatsApp 9 pm – 8 am" + toggle in the WhatsApp column (default on; tooltip "Quiet hours on/off"; disabled + "Turn on WhatsApp first" when WhatsApp is off). | SR:152, SR:232-233 |
| ST-11 | Turn WhatsApp off | Toggle click → WhatsApp off at once, toast "WhatsApp turned off" + Undo (must restore, G4); Profile chip → "Off"; matrix WhatsApp column disabled; Notifications page card drops "✓ WhatsApp". | SR:230 |
| ST-12 | **Turn on WhatsApp pop-up** | `.ov.tb-ov` centred, dialog **460 px**. Header: `.ic` `--ok` WhatsApp + "Turn on WhatsApp" + Close. Body: 3-step track (flex, gap 8): node 24 `--ok-chip` ✓ "Number" — 2 px `--ok` line — node 24 navy **pulsing** "2" "Code" — 2 px dashed `--border` line — node 24 panel/muted inset border "3" "Done" (labels 700 12 px; last muted). Field "WhatsApp number": prefix box `+91` (70 px, mono) + number input (mono). "Code sent to WhatsApp": 6 one-digit inputs in a 6-column grid gap 8, **44 px high, 18 px, centred, mono**; the active digit has a navy border; typing advances, backspace goes back, paste fills all. Consent checkbox (16 px, navy accent): "Send me WhatsApp updates about Northwind. Reply STOP to stop." Footer: Cancel (`btn-g`) + **Verify & turn on** (`btn-n`). Success → closes, WhatsApp on, toast "WhatsApp is on". Wrong code → inline error under the digits; "Resend code" link after 30 s (not drawn, recommended). | SR:168-181, SR:231, SW |
| ST-13 | Appearance card | `section.card#appearance`: navy `.ic` palette + "Appearance". `.tb-app` grid 2 columns gap 16×24, padding 12 18 16 (phone 1 column, padding 12): **Theme** `.lbl` + 3-tab pill Light · Dark · System (applies at once, remembered); **Reduce motion** `.lbl` + toggle (tooltip "Reduce motion on/off"). | SR:155-162, SR:220, SR:234 |
| ST-14 | Toast | `.toast.tb-toast`: green check 16 px (`oklch(80% .12 160)`) + text + "Undo" link. Texts: "Password changed", "WhatsApp turned off", "WhatsApp is on". | SR:167, SR:235 |
| ST-15 | Dropped vs current | Current page: big avatar card + Upload photo/Remove, Profile & Security cards with ✎ Edit, Role row, Appearance with Greeting-card and Sidebar swatches + Reduce motion, red **Sign out** footer button. Redesign: hero card with Change photo, no Role row (chip in hero), WhatsApp row + verified chip, device row, notification matrix, theme pill, no swatches (G3), **no Sign out button on the page** (it lives in the sidebar account row/menu). Staff-only Outlook card stays staff-only. | `settings_current.dc.html`, `AccountSettings.tsx:245-585` |

### 1.6 State matrix (every board state)

| Board / prop | State shown |
|---|---|
| TR | Team, All tab; tabs 0-3 by click; empty bubble when a tab is empty (needs data) |
| TI | Team + Invite dialog (filled: Ananya Rao / ananya@northwind.in) |
| TH | Team + Hand-off dialog (Rahul → Kavya Sen, checkbox ticked) |
| AR `tab=0..2` | Announcements All / Important / General; banner on |
| AE (`tab=1, empty=true`) | Important filter empty (deadline/compliance removed), banner hidden; See all resets |
| AD | Detail pop-up on item 1 of 6 (Deadline) |
| NR `tab=0..5` | All / Unread / Documents / Steps / Deadlines / Messages |
| NR `allRead=true` + `tab=1` = NE | All caught up bubble (answered bot) |
| NR `drill=0..4` (ND = 1) | Drill-down on All / Documents / Steps / Deadlines / Messages |
| NR hover states | Segment hover (`hv` 1-4), centre hover (`hv` 0), legend highlight |
| NR toast | "All marked read · Undo" (state only) |
| UR `tab=0..4` | Type filter (note: 6 types, prop enumerates 0-4) |
| UR `openId=n` (UF = tab 1, openId 2) | Documents filter with "Document sent back" details open |
| UR `drillDay=13/12/11/10` (UD = 10) | Day drill-down |
| UR who pill (state only) | Everyone / SBC / Northwind; empty state with Clear filters |
| SR default (`section=2`) | Settings, WhatsApp on |
| SP (`section=1, pwOpen`) | Change-password form open |
| SW (`section=2, waOff, waDialog`) | WhatsApp off + Turn-on dialog |
| SR `toast="…"` | Toast with text |

### 1.7 Breakpoint variants

| Width | Shell | Team | Announcements | Notifications | Audit | Settings |
|---|---|---|---|---|---|---|
| ≥1280 desktop | 248 px sidebar; full top bar (search 256) | 3 SBC cards per row; role chip + date columns | 8/4 grid | 9/3 grid | full grid `52 28 1fr 190 32` | 5/7 grid |
| 960-1279 tablet | 72 px rail (board sidebar children hidden), search 196 | cards auto-fit (≥250 px each) | 8/4 | 9/3 | as desktop | 5/7 |
| 768-959 | rail; search icon-only; "Home /" hidden | cards auto-fit | stacked (portals under) | stacked; side cards auto-fit min 240 | `48 28 1fr 150 32`, rail at 71, facts margin 86 | stacked |
| ≤767 phone | no rail, drawer via ☰; top bar shows ☰ + current page + search/ann/notif icons (40 px), theme hidden; content padding 16 16 104; toasts at bottom 96 | contact buttons 40 px; pill full row; role chip inline, date under email | banner wraps (Open right); host chip inline; pill full row | who·time under body; right column hidden; dot hit area +16 px; legend 40 px | day header horizontal (tile 50×52); grid `44 28 1fr 40`, who on row 2; facts full width auto-fit 120; search full row; bars gap 3; drill rows show who+role under text | kv key 92 px; matrix icon column hidden `1fr 60 76`; appearance 1 column; card paddings 14/12; Change photo hit area |
| ≤520 | | | | kind chip auto width, right-aligned | | |
| any phone | touch targets ≥ 40 px: `.btn`, `.btn-sm`, `.ibtn`, `.seg button`, `.tgl` hit area, `.info>button` | | | | | |

Source: TR:14-60, AR:56-61, NR:56-68, UR:56-80, SR:56-73, TB:31-46.

### 1.8 Before / after incorporation

No variant on any of the five pages (G15). Effects only through the shell: Incorporation badge `6/14` → `14/14` (SJ:269), Before/After pill (SH-09) and a toast. Data-driven differences in the real app: next-deadline banner and "Deadlines" notifications only exist once compliance items exist (usually after COI); Team/Audit/Settings are identical.

### 1.9 Animation and timing catalogue

| Name | Spec | Used on | Source |
|---|---|---|---|
| Card enter `up` | opacity 0 → 1, translateY 10 → 0, `.5s cubic-bezier(.2,.7,.2,1) backwards` | every `.card` | CSS:18, CSS:20 |
| Stagger `v7fade` | opacity 0, y 6 → 0, `.2s cubic-bezier(.22,1,.36,1) both` on `.stag>*` | Team main | CSS:94-95, TR:67 |
| Card hover | translateY(−2 px) + shadow + border, `.16s cubic-bezier(.22,1,.36,1)` | all cards | CSS:81-82 |
| Pill thumb spring | `transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)` (= framer spring 420/32/0.8) | all pills | CSS:72 |
| Pill label colour | `color .2s` | all pills | CSS:75 |
| Toggle knob | same spring .42 s; track bg `.2s` | Settings | CSS:136-138 |
| Button press | scale .98, `.12s cubic-bezier(.22,1,.36,1)`; bg `.15s` | all buttons | CSS:83-84 |
| Tooltip in | `tipin .12s ease` (opacity + 3 px rise); arrow `tipin2 .12s` | `[data-tip]` | CSS:166-170 |
| JS tooltip | delay 120 ms, opacity/transform `.12s` | aria-label icons | PJ:133-134, PJ:307 |
| (i) pop-over | opacity/transform/visibility `.15s`, −4 px → 0 | Settings (i) | CSS:111-113 |
| Unread pulse `v7pulse` | box-shadow 0 → 5 px gold ring `oklch(80% .12 85 / .7 → 0)`, `1.8s ease-in-out infinite` | Notifications unread dot; WhatsApp stepper node 2 | CSS:118 |
| Bot react `v7react` | scale .9 → 1.1 (rotate −4°) → .98 → 1, `.55s cubic-bezier(.22,1,.36,1)` | "All caught up" bot | CSS:99, CSS:103 |
| Bot idle | `bob 2.6s ease-in-out infinite` (−4 px), `botup .45s` delay .5 s | launcher | CSS:97-102 |
| Bar grow | `grow .9s cubic-bezier(.2,.7,.2,1) backwards` (scaleX, G12); opacity `.15s` | Audit 14-day bars | CSS:19, UR:98 |
| Donut segment | `stroke-width .15s` (18 → 24) | Notifications donut | NR:127-130 |
| Skeleton | `sk 1.2s linear infinite` shimmer | loading (rule 12) | CSS:150-151 |
| Page enter / leave | `vpIn .26s cubic-bezier(.22,1,.36,1)`; leave opacity .35 `.14s` then navigate at 140 ms | every navigation | PJ:135-137, PJ:116 |
| Toast | in `.18s` opacity + `.22s cubic-bezier(.22,1,.36,1)` 12 px rise; shown 3200 ms | global toast | PJ:130-131, PJ:166 |
| Drill "Show in the list ↓" | close, wait 60 ms, `window.scrollTo({top:200 | 280, behavior:'smooth'})` | Notifications / Audit drill | NR:275, UR:258 |
| Launcher | lift `.5s cubic-bezier(.34,1.45,.5,1)`; duck `.32s cubic-bezier(.5,0,.75,.4)`; pill bg `.15s` | global | PJ:328-334 |
| Reduced motion | everything above off | all | SH-29 |

---

## 2. DATA — what each element shows and where it comes from in the real app

Legend: **EXISTS** = usable today; **PARTIAL** = exists but needs a change; **NEW** = must be built (with the backend piece named). Every new repository must take an `AuthContext`, scope by role (Path A, `src/db/repositories/README.md`) and get a cross-tenant test (CLAUDE.md golden rules). Only repositories import `db`.

### 2.0 Shared

| UI | Source | Status |
|---|---|---|
| Current user (name, initials, email, role, avatar) | `useApp().user`; `GET /api/account/profile` → `getOwnProfile` (`src/db/repositories/profiles.ts:505`) | EXISTS |
| Client company name ("Northwind", "Northwind Technologies") | `useApp().engagements[0].companyName` (client has one engagement); short name = first word, or add `shortName` | PARTIAL (short name derived) |
| Primary or member | `GET /api/engagements/:id/clients` → `listEngagementClients` → `memberRole: 'owner' | 'member'`; owner also = `engagements.clientUserId` | EXISTS |
| Topbar notifications badge / sidebar Updates count | `useApp().unreadNotificationCount` (from `/api/notifications`, head poll) | EXISTS |
| Topbar announcements gold dot | `AnnouncementsBell` + `readAnnouncementIds` (localStorage) | PARTIAL → server read state (§2.2) |
| Theme | `next-themes` (`ThemeToggle`); schema `client_portal_prefs.theme` (light/dark/system) exists but has **no repository** | PARTIAL → NEW `client-portal-prefs` repository + `GET/PATCH /api/account/portal-prefs` |
| Ask VCFO chat | `src/components/ask/*` (`AskLauncher`, `AskPanel`, `AskProvider`) | EXISTS |
| Base CSS (tokens, `.card`, `.seg`, `.tgl`, `.dlg`, tooltips…) | `src/components/client-portal/css/10-base.css` (verbatim port of CSS, scoped `.cp`), `11-drill.css` | EXISTS (generated by `scripts/cp-css.mjs`) |
| Sliding pill motion | `src/components/shell/MotionActivePill.tsx`, `src/components/admin/SegmentedPicker.tsx` | EXISTS (restyle to navy thumb) |
| Bot avatar + bubble (rule 16) | no shared component in `src/components` | NEW `BotSays` component (avatar 40-56 + bubble + action) |

### 2.1 Team

| UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|
| SBC cards: name, role | Priya Raman · Project Manager; Arjun Mehta · Project Lead | `useClientOverview()` → `GET /api/client/overview` → `getClientOverview` → `loadTeam()` (`src/db/repositories/client-overview.ts:90`) → `ClientOverviewTeamMember {id,name,email,role}` (managers then leads, never "intern") | EXISTS |
| SBC card line (email) | priya.raman@sbc.in | same, `email` | EXISTS |
| SBC photo | initials placeholder | `profiles.avatarObjectKey` exists but `loadTeam` does not return it; avatar route serves own avatar only (`getOwnAvatarObjectKey`) | NEW: add `avatarUrl` to team member + a route that serves staff avatars to clients on the same engagement (scoped) |
| WhatsApp / Call buttons | wa.me / tel: | `profiles.phoneE164` exists (EngagementParty has it, `engagement-recipients.ts:12-23`) but not passed to `ClientOverviewTeamMember` | PARTIAL: add `phoneE164` to the team member type; hide WA/Call when null |
| Teams button | Teams deep link | no Teams field anywhere (`outlookConnections.msEmail` is staff Graph mailbox) | NEW: use `outlookConnections.msEmail` or `email` for `https://teams.microsoft.com/l/chat/0/0?users=` (decide) |
| Customer support card | Farhat · support@sbc.in · +91 90597 90014 | nothing in code (no constant) | NEW: config (`SUPPORT_NAME`, `SUPPORT_EMAIL`, `SUPPORT_PHONE_E164`, `SUPPORT_TEAMS`) read server-side and returned with the overview (also used by the sidebar "Customer support" row) |
| People rows (name, email, Primary/Member, "Since …") | 3 people | `GET /api/engagements/:id/clients` (`app/api/engagements/[id]/clients/route.ts:23`) → `listEngagementClients` → `{userId,email,name,memberRole,invitedBy,createdAt}` | EXISTS ("Since" = `createdAt`, format `d MMM`) |
| Avatar colour per person | fixed demo colours | — | NEW (client-side: hash userId → palette) |
| Pending invite rows ("Invite sent", "Sent 6 Oct") | Ananya Rao | `invites` table exists (`schema.ts:685`: token, email, role, engagementId, acceptedAt, expiresAt, createdAt) and `src/db/repositories/invites.ts`, **but** `createInvite` throws for clients (`invites.ts:62-64`) and today's client invite (`inviteEngagementClient`, `engagement-clients.ts:154`) creates the account immediately with a temporary password | NEW: invite flow for clients — add `name`, `invitedBy`, `revokedAt` columns (migration); `createClientInvite(ctx, {engagementId, email, name})` (Primary only), `listPendingInvites(ctx, engagementId)` (accepted IS NULL, not revoked, not expired), `resendInvite` (new token, new expiry, email), `revokeInvite`; return pending rows with `/clients` GET or a new `GET /api/engagements/:id/invites` |
| Invite permission "Primary contact only" | tooltip | `inviteEngagementClient` lets **any** client on the engagement invite (`engagement-clients.ts:165-170`) | PARTIAL: enforce `memberRole==='owner' || eng.clientUserId===ctx.userId` for `ctx.role==='client'`; staff unchanged; test it (cross-tenant + member-denied) |
| Set-password link ("Expires in 7 days", Copy) | link by email | none: `src/views/auth/ResetPassword.tsx` says Auth.js credentials issue no recovery tokens; `/invite/[token]` (`src/views/auth/InviteAccept.tsx`) is the old localStorage demo | NEW: token issue (7-day expiry, hashed), `/invite/[token]` real page (set name + password → create profile + `engagement_clients` row → sign in), `POST /api/invites/accept`; email template (DB-backed email system, Resend/SES). **Interim (decision):** keep the temporary password (`DEFAULT_CLIENT_TEMP_PASSWORD`) and show it in the Sign-in box |
| Invite email | — | `sendWelcomeEmail` (`src/lib/email/welcome-email.ts`) with `clientPassword` | PARTIAL: new template for link; keep `toastEmailDispatch` result handling |
| Substitute / hand-off | Rahul → Kavya | `POST /api/engagements/:id/clients/substitute` (`substitute/route.ts:30`) → `substituteEngagementClient` (`engagement-clients.ts:316`) returns `actorLostAccess`, `becamePrimary`; outgoing person notified by `sendClientEmailChangedEmail` | EXISTS (switch password → set-password link later); client then `signOut()` as `ClientTeam.tsx:160-167` |
| Who may substitute | any row | repo: any client on the project may substitute anyone (`engagement-clients.ts:396-402`) | DECIDE: Primary only (consistent with invite) or self only for members |
| Audit trail of invite / substitute | — | `recordAuditEvent` `client.invite`, `client.substitute` already written | EXISTS (+ add `client.invite_resend`, `client.invite_revoke`) |
| Tab counts, empty texts | — | client-side | — |

### 2.2 Announcements

| UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|
| List | 6 items | `useAnnouncements()` (`src/lib/use-announcements.ts`) → `GET /api/announcements` → `listAnnouncements` (`src/db/repositories/announcements.ts:67`, firm-wide, newest first, cap 80/120) → `Announcement {id,title,body,kind,origin,sourceName,sourceUrl,authorId,authorName,authorRole,publishedAt}`; live head poll every 4 s (`?head=1` → `getAnnouncementBoardHead`) | EXISTS |
| Kind chip text | Deadline, MCA, Compliance, Tax, GST, Post-Incorp | `ANNOUNCEMENT_KIND_LABEL` (`src/lib/announcements.ts`) | EXISTS (colours per AN-06) |
| Date tile | 8 OCT | `publishedAt` in IST (`announcementYmdIst`) | EXISTS |
| "From Priya Raman" / "Official feed" | | `announcementAttribution` returns "From VCFOSuite" for feed | PARTIAL: feed → "Official feed" |
| Host chip ("mca.gov.in") | | `sourceUrl` → `new URL().hostname` minus `www.`; `sourceName` fallback | EXISTS (derive) |
| Filter All/Important/General | 6/2/4 | `announcementMatchesFilter` | PARTIAL (G9) |
| Unread dot / bold / tint / topbar dot | ids 1, 2 unread | `readAnnouncementIds(userId)` / `writeAnnouncementReadIds` in **localStorage** (`vcfo.announcements.read.<userId>`), event `ANNOUNCEMENT_READ_EVENT` | NEW (idea #1): table `announcement_reads(profile_id uuid fk, announcement_id uuid fk, read_at timestamptz, pk(profile_id, announcement_id))`; repo `listReadAnnouncementIds(ctx)`, `markAnnouncementsRead(ctx, ids[])` (own rows only); `GET /api/announcements?withRead=1` returns `read:boolean` per item, `POST /api/announcements/read {ids}`; migrate localStorage ids once on first load |
| Detail body | message text | `body` (fallback `title`) | EXISTS |
| Detail author block (photo, role, time, WhatsApp/Email) | Priya Raman · Project Manager · 8 Oct, 09:05 | `authorName`, `authorRole` (map role → "Project Manager"/"Project Lead"), `publishedAt`; no author phone/email/avatar | NEW (small): join `profiles` on `authorId` for `avatarUrl`, `email`, `phoneE164` **only when the author is on the client's engagement team** (else hide contact buttons) |
| Next-deadline banner | GSTR-3B for September · 20 Oct · in 12 days | `useClientOverview()` → `overview.compliance.upcoming[0]` `{id,title,authority,group,dueDate,status,periodLabel}` (`loadComplianceRunway`) | EXISTS (days = dueDate − today IST; title = `title` + period) |
| Official portals | Setup 8 / Recurring 4 | `groupedVcfoPortalTasks()` / `VCFO_PORTAL_TASKS` (`src/lib/announcement-portals.ts`); setup = non-recurring heads, recurring = Monthly/Quarterly/Half-yearly/Yearly (`OfficialPortalsDirectory.tsx:11-16`); links `portalUrl`, `circularUrl` | EXISTS (counts = real task counts; hide an icon when its URL is null) |
| Compose / feeds | not shown to clients | `canWriteAnnouncements`, `canManageAnnouncementSources` | EXISTS (staff only, unchanged) |

### 2.3 Notifications

| UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|
| Rows (title, body, time, read) | 11 items | `useNotificationHistory()` (`src/lib/use-notification-history.ts`) → `GET /api/notifications?history=1` → `listNotifications(ctx,{includeDismissed:true})` → `AppNotification {id,kind,title,body,engagementId,companyName,itemId,href,createdAt,read,dismissedAt}` | EXISTS |
| Day groups | Today / Earlier this week / Earlier | `groupNotificationsForHistory` (`src/lib/notification-dismiss.ts`) | EXISTS |
| Type → icon/chip/filter | doc, back, step, time, deadline, mail, ann, team | `NotificationKind` = checklist.deliver/submit/review/unlock, docs.share, request.created/uploaded, team.assigned/removed, email.sent/skipped/failed (`src/lib/checklist-notifications.ts:14-27`) | PARTIAL: map existing kinds → request.created → Request; checklist.review (rejected) / request sent back → Sent back; checklist.review (accepted)/deliver → Step; email.* → Email; team.* → Team. **NEW kinds**: `request.sent_back`, `timeline.changed`, `compliance.due` (deadline), `announcement.posted`, `team.joined` (+ producers: schedule/change-request approval, compliance digest job `src/jobs/compliance-generate.ts`, announcement create, invite accept) |
| Body parts with deep links (idea #9) | "Utility bill for the office" → step 7 … | only one `href` per notification today | NEW: optional `links jsonb` column on `notifications` (`[{label, href, external?}]`) filled by producers; fallback to `body` text + `href` |
| "who" (actor) + link to Team | Arjun Mehta | no actor on `notifications` | NEW: `actor_id uuid` (+ `actor_name` snapshot) column; client sees staff names only (no emails) |
| Mark one read | dot | `useApp().markNotificationRead(id)` → `POST /api/notifications {action:'mark_read', id}` | EXISTS |
| Mark all read | (G1) | `useApp().markAllNotificationsRead()` → `{action:'mark_all_read'}` | EXISTS |
| Undo mark all read | toast Undo | no "mark unread" | NEW: `{action:'mark_unread', ids}` → `markNotificationsUnread(ctx, ids)` (own rows) |
| Donut "This month" counts | 11 · 2/4/1/4 | client-side from history (createdAt in current IST month) | EXISTS (derive) |
| "Northwind gets these by" | ✓ Email ✓ WhatsApp | email always; WhatsApp = `getOwnProfile().whatsappOptIn` (+ `whatsappStatus`) | EXISTS (derive) |
| Delivery log ("Email sent: …") | Email rows | `notification_deliveries` (`listDeliveriesByEngagement`, staff route `/api/engagements/:id/notification-deliveries`) | OPTIONAL: email.* notifications already exist; no change needed |

### 2.4 Audit

| UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|
| Events | time, action, subject, who, role | `GET /api/audit-logs?limit=…` → `listAuditEvents` (`src/db/repositories/audit-events.ts:80`; client scope = own engagements) → `AuditEventRow {id,created_at,actor_user_id,actor_role,actor_email,actor_name,engagement_id,action,summary,metadata}` | EXISTS (scope) |
| Client-safe projection (decision + idea #2) | name + role, no emails, no internal metadata | route returns `actor_email` and raw `metadata` to clients today | NEW: `listClientAuditEvents(ctx, {before, limit})` (or a `view:'client'` branch) that (a) whitelists client-visible actions, (b) drops `actor_email`, ids and raw metadata, (c) maps `actor_role` → "Manager"/"Lead"/"Client"/"System" (never "intern"), (d) builds `facts[]` + `cta {label, href}` server-side per action |
| Categories (Documents · Milestones · Team · Email · Credentials) | pill | `getAuditActionCategory` (`src/lib/audit-log.ts:137`) → engagement/checklist/documents/admin/email/other | PARTIAL: client map — Documents = board_resolution, dir_2, incorporation_docs, milestone_document, document_request.*; Milestones = checklist.*, engagement change requests / schedule (timeline); Team = client.*; Email = welcome_email.*, email_templates.fire; Credentials = credentials.* |
| Who pill (SBC / Northwind) | | `actor_role` (client vs staff/system) | EXISTS (derive) |
| Missing producers | "Documents requested", "Document sent back", "Document uploaded", credentials views | `document-requests.ts` create/update record **no** audit event; credentials page has no audit (prototype uses `localStorage vcfo.credsAudit`) | NEW: `recordAuditEvent` in `createDocumentRequest` / `updateDocumentRequest` (`document_request.create/sent_back/upload`) and in the credentials reveal/copy route (`credentials.reveal`, `credentials.copy`) |
| 14-day bars + total | 20 events | none | NEW (light): `GET /api/audit-logs?summary=14d` → counts per IST day for the scoped engagement (or compute client-side from the first page if ≤ 500) |
| Search | text | client-side over loaded rows (current `AuditLog.tsx:88` does a haystack filter) | EXISTS (pattern) |
| Load older | button | `listAuditEvents` supports `before` (keyset) but the route ignores it | PARTIAL: accept `?before=<iso>` in `app/api/audit-logs/route.ts` |
| Export CSV/PDF (idea #3) | button | none | NEW: `GET /api/audit-logs/export?format=csv` streaming the client-safe projection |
| Day drill-down | per-day events | client-side from loaded rows (or `?day=YYYY-MM-DD`) | EXISTS / small |

### 2.5 Settings

| UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|
| Hero (name, email, avatar, Primary chip, company) | Rahul Khanna | `GET /api/account/profile` → `getOwnProfile` (`profiles.ts:505`: id,name,email,phone,phoneE164,whatsappOptIn,whatsappStatus,role,avatarUrl); Primary from §2.0; company from engagement | EXISTS |
| Change photo | camera | `POST/DELETE /api/account/avatar` (`AccountSettings.tsx:625-690`, `IdentityCard`); Outlook photo staff only | EXISTS |
| Profile rows + Edit | name, email, phone, WhatsApp | `PATCH /api/account/profile` (name, phone, phoneE164, whatsappOptIn, email + currentPassword) → `updateOwnProfile` | EXISTS |
| WhatsApp "Verified" chip | Verified | `profiles.whatsappStatus` enum unknown/verified/failed | PARTIAL: set `verified` only after OTP (below) |
| Password "changed 2 Sep" | | no column | NEW: `profiles.password_changed_at` set by `updateOwnPassword` and invite acceptance |
| Change password | form | `POST /api/account/password {currentPassword,newPassword}` → `updateOwnPassword` (min 8) | EXISTS (strength meter client-side: 8+ chars, number, symbol) |
| "This device · Chrome on Windows · Hyderabad · Active now" (idea #8) | | Auth.js JWT sessions; no session table | NEW: `user_sessions` (id, profile_id, user_agent, ip_city, created_at, last_seen_at, revoked_at) written on sign-in/refresh; repo `listOwnSessions`, `revokeOtherSessions`; city via IP lookup (optional) |
| Email "Always on" | | — | static |
| WhatsApp on/off | toggle | `PATCH /api/account/profile {whatsappOptIn:false}` → sets `whatsappOptOutAt`; on requires number + consent | EXISTS (off) |
| Turn on WhatsApp with code | 6-digit code via WhatsApp | no OTP; consent is a tick box only (`AccountSettings.tsx:383-398`) | NEW: `POST /api/account/whatsapp/start {phoneE164}` (sends an OTP template via `src/lib/notify/send-whatsapp.ts` → EUM; new template e.g. `verify_code`), `POST /api/account/whatsapp/verify {code}` (sets `phoneE164`, `whatsappOptInAt`, `whatsappStatus='verified'`); store hashed code + expiry (10 min) + attempt count (table `whatsapp_verifications` or columns). WhatsApp failures must never affect email (CLAUDE.md) |
| Per-category Email / WhatsApp matrix (idea #6) | 7 rows | nothing: `NOTIFY_EVENTS` = welcome, coi_issued, document_delivered, compliance_due_monthly, compliance_due_quarterly, compliance_overdue (`src/lib/notify/types.ts`) | NEW: table `notification_prefs(profile_id pk/fk, email jsonb, whatsapp jsonb, quiet_hours boolean default true, quiet_start time '21:00', quiet_end time '08:00', tz text 'Asia/Kolkata', updated_at)`; categories `docs, steps, deadlines, timeline` (email locked true, server ignores false), `announcements`, `feed`, `weekly_digest` (email only); repo `getOwnNotificationPrefs` / `updateOwnNotificationPrefs` (own row only); `GET/PATCH /api/account/notification-prefs`; dispatchers (`send-email.ts`, `send-whatsapp.ts`) consult prefs per event→category; skip reason `disabled` already exists in `SkipReason` |
| Quiet hours | 9 pm – 8 am | none | NEW: in `notification_prefs`; WhatsApp sends during quiet hours are deferred (Inngest delay) or skipped with reason `quiet_hours` (add to `SkipReason`) |
| Weekly summary · Monday 9 am | email | no digest for clients | NEW: Inngest cron (`src/jobs/`) Monday 09:00 IST, respects prefs |
| Theme Light/Dark/System | pill | `next-themes`; `client_portal_prefs.theme` (schema only) | PARTIAL: persist via NEW portal-prefs repository |
| Reduce motion | toggle | `useShellAppearance()` (`src/lib/use-shell-appearance.ts`, localStorage) `prefs.reduceMotion` | EXISTS (local; optionally add `reduce_motion` to `client_portal_prefs`) |
| Sign out | (not on page) | `useApp().signOut()`; shell account row | EXISTS |

---

## 3. LAYOUT AND CSS — verbatim excerpts

Everything below is copied byte-for-byte from the prototype sources (only `<svg>` paths are kept, since icons must match). Where a block is long, it is the complete block. Token values are in §3.1.

### 3.1 Base stylesheet (tokens + every shared class). Complete file.

Already ported verbatim to `src/components/client-portal/css/10-base.css` (scoped to `.cp` instead of `:root`/`body`). Lines 119-173 are the "client pages additions" written for these five pages.

#### Board stylesheet — `b/ecdc4c28c4511de8452c7a5f1e7f79e6.css:1-173`

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

### 3.2 Responsive contract shared by all five page boards (identical in TR, AR, NR, UR, SR)

#### Responsive contract — `s/team/team_redesign.dc.html:13-55`

```css
<style>body{margin:0}
/* v7 responsive contract (team boards): phone <=767, tablet 768-1279 (72 px rail), desktop >=1280 */
:root{--vp-side-w:248px}
@media (max-width:1279px){:root{--vp-side-w:72px}}
@media (max-width:767px){:root{--vp-side-w:0px}}
.tb-root{position:relative;width:100%;min-height:100vh;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.tb-side{width:var(--vp-side-w,248px);flex:none;background:#0f2a4a;overflow:hidden;min-width:0}
.tb-side>*{width:248px}
.tb-main{flex:1;min-width:0}
.pg.tb-wrap{width:100%;max-width:1600px;margin-inline:auto;box-sizing:border-box;padding:clamp(16px,2vw,24px) clamp(16px,2vw,24px) 96px}
.tb-launch{position:absolute;right:0;top:870px}
.tb-segx{max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;border-radius:8px;-webkit-overflow-scrolling:touch}
.tb-segx::-webkit-scrollbar{display:none}
.tb-segx>.seg{width:max-content;min-width:100%;box-sizing:border-box}
.tb-m{display:none!important}
/* no text under 11 px */
html .lbl{font-size:11px}
html .seg .cnt,html .kbd{font-size:11px}
html .dtile .m{font-size:11px;letter-spacing:.06em}
/* pop-ups fit the viewport */
.tb-ov{position:fixed!important;inset:0;z-index:60!important;overflow:auto;padding:var(--ovt,12px) 12px 12px;box-sizing:border-box}
.tb-ov.tb-top{--ovt:min(120px,12vh);align-items:flex-start!important}
.tb-ov>.dlg{max-width:calc(100vw - 24px);max-height:calc(100dvh - var(--ovt,12px) - 12px);overflow:auto;flex:none;box-sizing:border-box}
.tb-toast{position:fixed!important;left:calc(50% + var(--vp-side-w,248px) / 2)!important;bottom:24px;max-width:calc(100vw - 24px);box-sizing:border-box;z-index:61!important}
@media (max-width:1279px){.tb-side>*{display:none!important}}
@media (max-width:767px){
  .tb-side{display:none}
  .pg.tb-wrap{padding:16px 16px 104px}
  .tb-d{display:none!important}
  .tb-m{display:revert!important}
  .tb-m.tb-flex{display:flex!important}
  .tb-m.tb-iflex{display:inline-flex!important}
  .tb-ov.tb-top{--ovt:12px;align-items:center!important}
  .tb-toast{left:50%!important;bottom:96px}
  .tb-hd>.tb-segx{flex:1 1 100%;margin-left:0!important}
  /* touch targets >= 40 px */
  html .btn,html .btn-sm{height:40px;min-height:40px}
  html .ibtn{width:40px;height:40px}
  html .seg button{height:40px}
  html .tgl{position:relative}
  html .tgl::before{content:"";position:absolute;left:-2px;right:-2px;top:-9px;bottom:-9px}
  html .info>button{width:40px;height:40px;margin:-11px}
}
```

### 3.3 Top bar (component used by all five pages)

#### Top bar CSS + markup — `s/team/topbar.dc.html:13-69`

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
```

#### Top bar logic (active states, badge, gold dot) — `s/team/topbar.dc.html:72-88`

```js
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
```

### 3.4 Team

Desktop: SBC cards in an auto-fit grid (min 250 px) above the People card. Phone: same order, `.tb-m` elements appear and `.tb-d` disappear (role chip inline, date under email), contact buttons 40 px.

#### Team page-specific CSS — `s/team/team_redesign.dc.html:56-60`

```css
.tb-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:16px}
.tb-line{overflow-wrap:anywhere}
.tb-ph{display:flex;align-items:center;gap:10px;padding:14px 16px;flex-wrap:wrap}
.tb-ph .tb-segx{margin-left:auto}
@media (max-width:767px){.tb-cbtn{height:40px!important}.tb-ph .tb-segx{margin-left:0;flex:1 1 100%}}
```

#### Team markup (page frame, Invite, SBC cards, People card, rows, empty state) — `s/team/team_redesign.dc.html:63-126`

```html
<div class="tb-root">
  <div class="tb-side" data-vp="side"><dc-import name="side" active="6" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="tb-main">
    <dc-import name="topbar" crumb="Team" hint-size="100%,52px" style="display:block;width:100%"></dc-import>
    <main class="pg tb-wrap stag">
      <div class="ph">
        <div class="acts"><button type="button" class="btn btn-n" data-tip="Only the Primary contact can invite"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M18 8v6 M15 11h6"></path></svg>Invite</button></div>
      </div>

      <section class="tb-cards">
        <sc-for list="{{sbc}}" as="p" hint-placeholder-count="3">
          <article class="card t" style="padding:18px;gap:14px">
            <div style="display:flex;align-items:center;gap:14px">
              <div title="Photo placeholder" style="width:60px;height:60px;border-radius:99px;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font:700 18px Space Grotesk;box-shadow:0 0 0 3px var(--panel),0 0 0 5px {{p.ring}};{{p.bg}}">{{p.ini}}</div>
              <div style="min-width:0;flex:1">
                <span class="chip" style="{{p.chip}}">{{p.role}}</span>
                <div style="font:700 16px Manrope;margin-top:6px;color:var(--navy-ink,var(--navy))">{{p.name}}</div>
                <div class="mono tb-line" style="font-size:11px;color:var(--muted);margin-top:2px">{{p.line}}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
              <a href="#" class="btn wa tb-cbtn" aria-label="WhatsApp {{p.name}}" style="height:38px;padding:0" data-tip="WhatsApp {{p.name}}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z M9.2 8.8c.2-.4.6-.4.9-.2l.8 1.4c.1.3 0 .6-.2.8l-.4.4c.4.9 1.2 1.7 2.1 2.1l.4-.4c.2-.2.5-.3.8-.2l1.4.8c.3.2.3.6.1.9-.5.8-1.4 1.1-2.3.7a7 7 0 0 1-3.7-3.7c-.4-.9-.1-1.8.1-2.6Z"></path></svg></a>
              <a href="#" class="btn btn-o tb-cbtn" aria-label="Call {{p.name}}" style="height:38px;padding:0;color:var(--navy-ink,var(--navy))" data-tip="Call {{p.name}}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h2.2l1.3 3.6-1.8 1.2a10 10 0 0 0 6.5 6.5l1.2-1.8L20 14.8V17a2 2 0 0 1-2 2A14 14 0 0 1 5 6a2 2 0 0 1 2-2Z"></path></svg></a>
              <a href="#" class="btn btn-o tb-cbtn" aria-label="Email {{p.name}}" style="height:38px;padding:0;color:var(--navy-ink,var(--navy))" data-tip="Email {{p.name}}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5"></path></svg></a>
              <a href="#" class="btn btn-o tb-cbtn" aria-label="Teams {{p.name}}" style="height:38px;padding:0;color:light-dark(oklch(48% 0.14 280), oklch(80.8% 0.098 280))" data-tip="Teams {{p.name}}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7h10v10h-10Z M6.5 10h4 M8.5 10v5 M16.5 9.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4Z M15.5 11h5v4.5a2.5 2.5 0 0 1-5 0"></path></svg></a>
            </div>
          </article>
        </sc-for>
      </section>

      <section class="card">
        <div class="tb-ph">
          <span class="ic" style="background:var(--violet)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M15.5 5.7a3.3 3.3 0 0 1 0 6.4"></path></svg></span>
          <h2 class="h3">People from Northwind</h2>
          <div class="tb-segx"><div class="seg" role="tablist" style="grid-template-columns:repeat(4,minmax(0,1fr))"><span class="thumb" style="width:calc((100% - 4px)/4);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="4"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div>
        </div>
        <div style="border-top:1px solid var(--hair)">
          <sc-if value="{{noRows}}" hint-placeholder-val="{{false}}">
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:10px;padding:32px 16px">
              <span style="display:flex;flex:none"><dc-import name="v7c_bot" state="idle" size="48" hint-size="48px,48px"></dc-import></span>
              <div role="status" style="max-width:300px;background:var(--panel);border:1px solid var(--border);border-radius:10px 10px 10px 3px;padding:10px 12px;box-shadow:var(--shadow)">
                <div class="rt" style="font-weight:700">{{emptyText}}</div>
                <div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button type="button" class="btn btn-o btn-sm">Invite</button><a href="#" style="font-size:12px">Ask VCFO why</a></div>
              </div>
            </div>
          </sc-if>
          <sc-for list="{{rows}}" as="r" hint-placeholder-count="4">
            <div class="row" style="padding:12px 16px">
              <span class="av" style="width:36px;height:36px;font-size:12px;{{r.av}}">{{r.ini}}</span>
              <div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="rt">{{r.name}}</span><sc-if value="{{r.you}}" hint-placeholder-val="{{false}}"><span class="chip" style="background:var(--gold-soft);color:var(--gold-text)">Northwind</span></sc-if><span class="chip tb-m tb-iflex" style="{{r.roleStyle}}">{{r.role}}</span></div><div class="mono" style="font-size:11px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{r.email}}</div><div class="mono tb-m" style="font-size:11px;color:var(--muted);margin-top:2px">{{r.when}}</div></div>
              <span class="chip tb-d" style="{{r.roleStyle}}">{{r.role}}</span>
              <span class="mono tb-d" style="width:110px;font-size:11.5px;color:var(--muted);text-align:right;flex:none">{{r.when}}</span>
              <div style="display:flex;gap:6px;min-width:76px;flex:none;justify-content:flex-end">
                <sc-if value="{{r.pending}}" hint-placeholder-val="{{false}}"><button type="button" class="ibtn" aria-label="Resend invite to {{r.email}}" data-tip="Resend invite to {{r.email}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 0 1 13-5 M19.5 12a7.5 7.5 0 0 1-13 5 M17.5 3.5v3.5H14 M6.5 20.5V17H10"></path></svg></button><button type="button" class="ibtn" aria-label="Cancel invite" data-tip="Cancel invite"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button></sc-if>
                <sc-if value="{{r.member}}" hint-placeholder-val="{{true}}"><button type="button" class="ibtn" aria-label="Substitute {{r.name}}" data-tip="Substitute {{r.name}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3.5-3.5 M20 16H7l3.5 3.5"></path></svg></button></sc-if>
              </div>
            </div>
          </sc-for>
        </div>
      </section>
    </main>
  </div>
  <div class="tb-launch"><dc-import name="launcher" hint-size="160px,130px"></dc-import></div>
</div>
```

#### Team demo data + filter logic — `s/team/team_redesign.dc.html:129-152`

```js
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { tab: 0 }; }
  renderVals() {
    const s = this.state;
    const sbc = [
      { name: 'Priya Raman', role: 'Project Manager', ini: 'PR', line: 'priya.raman@sbc.in', bg: 'background:oklch(62% 0.08 40)', ring: 'var(--gold)', chip: 'background:var(--navy);color:#fff' },
      { name: 'Arjun Mehta', role: 'Project Lead', ini: 'AM', line: 'arjun.mehta@sbc.in', bg: 'background:oklch(55% 0.09 200)', ring: 'var(--gold)', chip: 'background:var(--navy);color:#fff' },
      { name: 'Farhat', role: 'Customer support', ini: 'F', line: 'support@sbc.in · +91 90597 90014', bg: 'background:var(--navy-3)', ring: 'var(--border)', chip: 'background:var(--prog-light);color:var(--prog-text)' }
    ];
    const P = [
      { name: 'Rahul Khanna', ini: 'RK', email: 'rahul@northwind.in', role: 'Primary', when: 'Since 2 Sep', you: true, k: 'p', av: 'background:var(--primary-fill,var(--primary))' },
      { name: 'Meera Iyer', ini: 'MI', email: 'meera@northwind.in', role: 'Member', when: 'Since 12 Sep', k: 'm', av: 'background:oklch(52% 0.13 330)' },
      { name: 'Dev Sharma', ini: 'DS', email: 'dev.sharma@northwind.in', role: 'Member', when: 'Since 30 Sep', k: 'm', av: 'background:oklch(50% 0.12 200)' },
      { name: 'Ananya Rao', ini: 'AR', email: 'ananya@northwind.in', role: 'Invite sent', when: 'Sent 6 Oct', k: 'i', pending: true, av: 'background:var(--up);color:var(--fg)' }
    ];
    const TABS = [['All', 4, null], ['Primary', 1, 'p'], ['Members', 2, 'm'], ['Invited', 1, 'i']];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const key = TABS[s.tab][2];
    const rows = P.filter((r) => !key || r.k === key).map((r) => ({
      ...r, you: Boolean(r.you), pending: Boolean(r.pending), member: !r.pending,
      roleStyle: r.k === 'p' ? 'background:var(--navy);color:#fff' : r.k === 'i' ? 'background:var(--due-light);color:var(--due-text)' : 'background:var(--raised);color:var(--muted)'
    }));
    return { sbc, tabs, rows, noRows: rows.length === 0, emptyText: s.tab === 3 ? 'No pending invites.' : 'No one here yet.', thumb: 'transform:translateX(' + (s.tab * 100) + '%)' };
  }
```

#### Invite a colleague pop-up — `s/team/team_invite.dc.html:17-47`

```html
  <div class="ov">
    <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="inv-t">
      <div class="dlg-h">
        <span class="ic" style="background:var(--navy)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M18 8v6 M15 11h6"></path></svg></span>
        <h2 id="inv-t" style="margin:0;font:700 16px Manrope;color:var(--navy-ink,var(--navy))">Invite a colleague</h2>
        <button type="button" class="ibtn" aria-label="Close" style="margin-left:auto;border:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
      </div>
      <div class="dlg-b">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
          <label class="fl">Name<input class="inp" value="Ananya Rao"></label>
          <label class="fl">Work email<input class="inp" type="email" value="ananya@northwind.in"></label>
        </div>
        <div class="fl">
          <span>Sign-in</span>
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid var(--border)">
            <span class="ic" style="background:var(--navy)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></span>
            <span style="flex:1;min-width:0"><span class="rt" style="display:block">Set-password link by email</span><span class="cap">Expires in 7 days</span></span>
            <button type="button" class="ibtn" aria-label="Copy the link" data-tip="Copy the link"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9h10v11H9Z M5 15V4h10"></path></svg></button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--raised)">
          <span class="chip" style="background:var(--raised);color:var(--muted);box-shadow:inset 0 0 0 1px var(--border)">Member</span>
          <span style="font-size:12px;font-weight:600">Sees everything on Northwind. Cannot invite.</span>
        </div>
      </div>
      <div class="dlg-f">
        <button type="button" class="btn btn-g">Cancel</button>
        <button type="button" class="btn btn-n"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12 20 4l-4 16-4-7Z M12 13l8-9"></path></svg>Send invite</button>
      </div>
    </div>
  </div>
```

#### Hand off your seat pop-up — `s/team/team_handoff.dc.html:17-53`

```html
  <div class="ov">
    <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="ho-t" style="width:500px">
      <div class="dlg-h">
        <span class="ic" style="background:var(--over-chip)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3.5-3.5 M20 16H7l3.5 3.5"></path></svg></span>
        <h2 id="ho-t" style="margin:0;font:700 16px Manrope;color:var(--navy-ink,var(--navy))">Hand off your seat</h2>
        <button type="button" class="ibtn" aria-label="Close" style="margin-left:auto;border:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
      </div>
      <div class="dlg-b">
        <div style="display:grid;grid-template-columns:1fr 28px 1fr;align-items:center;gap:10px">
          <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:8px"><span class="av" style="width:34px;height:34px;font-size:11px;background:var(--primary-fill,var(--primary))">RK</span><div style="min-width:0"><div class="rt">Rahul Khanna</div><div class="cap">Primary · Northwind</div></div></div>
          <span style="color:var(--over)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16 M14 6l6 6-6 6"></path></svg></span>
          <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px dashed var(--navy-3);border-radius:8px;background:var(--primary-light)"><span class="av" style="width:34px;height:34px;font-size:11px;background:var(--navy)">KS</span><div style="min-width:0"><div class="rt">Kavya Sen</div><div class="cap">New Primary</div></div></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--over-light);color:var(--over-text);font-weight:700;font-size:12.5px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4 21 20H3Z M12 10v4 M12 17h.01"></path></svg>
          You lose access to Northwind right after this.
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
          <label class="fl">Name<input class="inp" value="Kavya Sen"></label>
          <label class="fl">Work email<input class="inp" type="email" value="kavya.sen@northwind.in"></label>
        </div>
        <div class="fl">
          <span>Sign-in for Kavya</span>
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid var(--border)">
            <span class="ic" style="background:var(--navy)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></span>
            <span style="flex:1;min-width:0"><span class="rt" style="display:block">Set-password link by email</span><span class="cap">Expires in 7 days</span></span>
            <button type="button" class="ibtn" aria-label="Copy the link" data-tip="Copy the link"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9h10v11H9Z M5 15V4h10"></path></svg></button>
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:10px;font-size:12.5px;font-weight:600"><input type="checkbox" checked style="width:16px;height:16px;accent-color:var(--navy)">I understand I will be signed out</label>
      </div>
      <div class="dlg-f">
        <button type="button" class="btn btn-g">Cancel</button>
        <button type="button" class="btn" style="background:var(--over-chip);color:#fff">Hand off &amp; leave</button>
      </div>
    </div>
  </div>
```

### 3.5 Announcements

Desktop: optional deadline banner, then 12-column grid (Latest 8 / Official portals 4). ≤959: stacked. Phone: banner wraps, host chip moves inline.

#### Announcements page-specific CSS — `s/team/ann_redesign.dc.html:56-61`

```css
.tb-g12{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}
.tb-s8{grid-column:span 8}.tb-s4{grid-column:span 4}
.tb-hd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--hair);flex-wrap:wrap}
.tb-hd .tb-segx{margin-left:auto}
@media (max-width:959px){.tb-s8,.tb-s4{grid-column:1 / -1}}
@media (max-width:767px){.tb-focus{flex-wrap:wrap;padding:12px 14px!important}.tb-focus .btn{margin-left:auto}}
```

#### Announcements markup — `s/team/ann_redesign.dc.html:64-131`

```html
<div class="tb-root">
  <div class="tb-side" data-vp="side"><dc-import name="side" active="1" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="tb-main">
    <dc-import name="topbar" crumb="Announcements" mid="Updates" active="ann" hint-size="100%,52px" style="display:block;width:100%"></dc-import>
    <main class="pg tb-wrap">
      <sc-if value="{{hasFocus}}" hint-placeholder-val="{{true}}">
        <section class="tb-focus" style="position:relative;display:flex;align-items:center;gap:16px;padding:14px 18px;border-radius:10px;background:var(--due-light);border:1px solid oklch(66% 0.17 48 / .35)">
          <div class="dtile" style="background:var(--due-chip);color:#fff"><span class="d">20</span><span class="m">Oct</span></div>
          <div style="flex:1;min-width:0"><div class="lbl" style="color:var(--due-text)">Next deadline · in 12 days</div><div style="font:700 16px Manrope;color:var(--fg);margin-top:3px">GSTR-3B for September</div></div>
          <a href="#" class="btn btn-o btn-sm">Open</a>
        </section>
      </sc-if>

      <div class="tb-g12">
        <section class="card tb-s8">
          <div class="tb-hd">
            <h2 class="h3">Latest</h2>
            <div class="tb-segx"><div class="seg" role="tablist" aria-label="Filter announcements"><span class="thumb" style="width:calc((100% - 4px)/3);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="3"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div>
          </div>
          <sc-if value="{{isEmpty}}" hint-placeholder-val="{{false}}">
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:10px;padding:56px 16px 64px">
              <span style="display:flex;flex:none"><dc-import name="v7c_bot" state="idle" size="52" hint-size="52px,52px"></dc-import></span>
              <div role="status" style="max-width:300px;background:var(--panel);border:1px solid var(--border);border-radius:10px 10px 10px 3px;padding:10px 12px;box-shadow:var(--shadow)">
                <div class="rt" style="font-weight:700">No important updates right now.</div>
                <div class="cap" style="margin-top:2px">Deadlines will show up here first.</div>
                <div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button type="button" class="btn btn-o btn-sm" onClick="{{showAll}}">See all</button><a href="#" style="font-size:12px">Ask VCFO why</a></div>
              </div>
            </div>
          </sc-if>
          <sc-for list="{{rows}}" as="a" hint-placeholder-count="6">
            <a href="#" onClick="{{a.open}}" class="{{a.cls}}" style="color:inherit;font-weight:inherit;text-decoration:none">
              <div class="dtile" style="{{a.tile}}"><span class="d">{{a.d}}</span><span class="m">{{a.m}}</span></div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:4px 8px;flex-wrap:wrap"><span class="chip" style="{{a.chip}}">{{a.kind}}</span><span class="cap">{{a.by}}</span><sc-if value="{{a.feed}}" hint-placeholder-val="{{false}}"><span class="chip tb-m tb-iflex" style="background:var(--raised);color:var(--muted);box-shadow:inset 0 0 0 1px var(--border)">{{a.host}}</span></sc-if></div>
                <div class="rt" style="margin-top:4px;font-size:14px;{{a.tw}}">{{a.t}}</div>
              </div>
              <sc-if value="{{a.feed}}" hint-placeholder-val="{{false}}"><span class="chip tb-d" style="background:var(--raised);color:var(--muted);box-shadow:inset 0 0 0 1px var(--border)">{{a.host}}</span></sc-if>
              <sc-if value="{{a.unread}}" hint-placeholder-val="{{true}}"><span class="udot" role="img" aria-label="Unread" data-tip="Unread"></span></sc-if>
            </a>
          </sc-for>
        </section>

        <section class="card t tb-s4">
          <div style="display:flex;align-items:center;gap:10px;padding:14px 16px">
            <span class="ic" style="background:var(--navy)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 20.5h17 M5 20.5V10 M9.5 20.5V10 M14.5 20.5V10 M19 20.5V10 M3 10h18L12 3.5Z"></path></svg></span>
            <h2 class="h3">Official portals</h2>
          </div>
          <div style="padding:0 16px 10px"><div class="seg" role="tablist" style="grid-template-columns:repeat(2,minmax(0,1fr));width:100%"><span class="thumb" style="width:calc((100% - 4px)/2);{{pthumb}}"></span><button type="button" role="tab" class="{{p0}}" onClick="{{pp0}}">Setup<span class="cnt">8</span></button><button type="button" role="tab" class="{{p1}}" onClick="{{pp1}}">Recurring<span class="cnt">4</span></button></div></div>
          <div style="padding:0 16px 14px;display:flex;flex-direction:column;gap:12px">
            <sc-for list="{{portals}}" as="g" hint-placeholder-count="3">
              <div>
                <div class="lbl" style="margin-bottom:6px">{{g.h}}</div>
                <sc-for list="{{g.rows}}" as="r" hint-placeholder-count="2">
                  <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--hair)">
                    <span class="rt" style="flex:1;min-width:0">{{r}}</span>
                    <a href="#" class="ibtn" aria-label="Open portal for {{r}}" title="Portal" data-tip="Open portal for {{r}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7 M9 7h8v8"></path></svg></a>
                    <a href="#" class="ibtn" aria-label="Read circular for {{r}}" title="Circular" data-tip="Read circular for {{r}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7Z M14 3.5v4h4 M10 13h5 M10 16.5h5"></path></svg></a>
                  </div>
                </sc-for>
              </div>
            </sc-for>
          </div>
        </section>
      </div>
    </main>
  </div>
  <div class="tb-launch"><dc-import name="launcher" hint-size="160px,130px"></dc-import></div>
</div>
```

#### Announcements data + logic (filters, read state, portals) — `s/team/ann_redesign.dc.html:133-170`

```js
<script type="text/x-dc" data-dc-script data-props='{"tab":{"editor":"enum","options":[0,1,2],"default":0},"empty":{"editor":"boolean","default":false},"$preview":{"width":1440,"height":1100}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {}; }
  renderVals() {
    const s = this.state;
    const tab = s.tab !== undefined ? s.tab : Number(this.props.tab ?? 0);
    const empty = Boolean(this.props.empty) && s.tab === undefined;
    const neutral = 'background:var(--raised);color:var(--navy-ink,var(--navy));box-shadow:inset 0 0 0 1px var(--border)';
    const KC = { Deadline: 'background:var(--due-chip);color:#fff', Compliance: 'background:var(--prog-chip);color:#fff' };
    const A = [
      { id: 1, kind: 'Deadline', t: 'GSTR-3B for September is due on 20 Oct', by: 'From Priya Raman', d: '8', m: 'Oct', u: 1 },
      { id: 2, kind: 'MCA', t: 'MCA V3 portal down 11–12 Oct for an upgrade', by: 'Official feed', host: 'mca.gov.in', d: '7', m: 'Oct', u: 1, feed: 1 },
      { id: 3, kind: 'Compliance', t: 'DIR-3 KYC window is open for all directors', by: 'From Priya Raman', d: '3', m: 'Oct' },
      { id: 4, kind: 'Tax', t: 'Advance tax: third instalment due 15 Dec', by: 'Official feed', host: 'incometax.gov.in', d: '1', m: 'Oct', feed: 1 },
      { id: 5, kind: 'GST', t: 'GST invoice management system changes from 1 Nov', by: 'Official feed', host: 'gst.gov.in', d: '29', m: 'Sep', feed: 1 },
      { id: 6, kind: 'Post-Incorp', t: 'After COI: open the current account within 30 days', by: 'From Arjun Mehta', d: '24', m: 'Sep' }
    ];
    const imp = (a) => a.kind === 'Deadline' || a.kind === 'Compliance';
    const F = [() => true, imp, (a) => !imp(a)];
    const list = empty ? A.filter((a) => !imp(a)) : A;
    const tabs = ['All', 'Important', 'General'].map((l, i) => ({ label: l, cnt: list.filter(F[i]).length, cls: tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const read = s.read || {};
    const rows = list.filter(F[tab]).map((a) => {
      const unread = Boolean(a.u) && !read[a.id];
      return { ...a, feed: Boolean(a.feed), unread, chip: KC[a.kind] || neutral,
        tile: a.kind === 'Deadline' ? 'background:var(--due-light);color:var(--due-text)' : 'background:var(--primary-light);color:var(--navy-ink,var(--navy))',
        cls: unread ? 'row unread' : 'row', tw: unread ? 'font-weight:800' : 'font-weight:600',
        open: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ read: { ...read, [a.id]: true } }); } };
    });
    const pt = s.pt || 0;
    const P = pt === 0
      ? [{ h: 'Incorporation', rows: ['Pre-Incorporation', 'Post-Incorporation'] }, { h: 'Registrations', rows: ['GST Registration', 'PF Registration', 'ESI Registration', 'PT Registration'] }, { h: 'FEMA', rows: ['FCGPR Filing', 'FLA Return'] }]
      : [{ h: 'Monthly', rows: ['GSTR-1 and GSTR-3B', 'TDS payment'] }, { h: 'Quarterly', rows: ['TDS returns', 'Advance tax'] }];
    return { tabs, rows, isEmpty: rows.length === 0, hasFocus: !empty,
      thumb: 'transform:translateX(' + (tab * 100) + '%)', showAll: () => this.setState({ tab: 0 }),
      portals: P, pthumb: 'transform:translateX(' + (pt * 100) + '%)', p0: pt === 0 ? 'on' : '', p1: pt === 1 ? 'on' : '',
      pp0: () => this.setState({ pt: 0 }), pp1: () => this.setState({ pt: 1 }) };
  }
```

#### Announcement detail pop-up — `s/team/ann_detail.dc.html:15-43`

```html
<div style="position:relative;width:1440px;height:1100px;overflow:hidden;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <dc-import name="ann_redesign" hint-size="1440px,1100px" style="display:block;width:1440px"></dc-import>
  <div class="ov" style="align-items:flex-start;padding-top:140px;box-sizing:border-box">
    <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="ad-t" style="width:560px">
      <div class="dlg-h" style="align-items:flex-start">
        <div class="dtile" style="background:var(--due-light);color:var(--due-text)"><span class="d">8</span><span class="m">Oct</span></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:6px;align-items:center"><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">Deadline</span><span class="chip" style="background:var(--raised);color:var(--muted)">Important</span></div>
          <h2 id="ad-t" style="margin:6px 0 0;font:700 18px/1.3 Space Grotesk;color:var(--navy-ink,var(--navy))">GSTR-3B for September is due on 20 Oct</h2>
        </div>
        <button type="button" class="ibtn" aria-label="Close" style="border:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
      </div>
      <div class="dlg-b" style="font-size:13.5px;line-height:1.6">
        <p style="margin:0">Please share the September sales and purchase invoices by 15 Oct so we can file on time. Late filing costs ₹50 a day.</p>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--raised)">
          <span class="av" style="width:30px;height:30px;font-size:10px;background:oklch(62% 0.08 40)">PR</span>
          <div style="flex:1"><div class="rt">Priya Raman</div><div class="cap">Project Manager · 8 Oct, 09:05</div></div>
          <a href="#" class="ibtn wa" aria-label="WhatsApp Priya Raman" data-tip="WhatsApp Priya Raman"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z"></path></svg></a>
          <a href="#" class="ibtn" aria-label="Email Priya Raman" data-tip="Email Priya Raman"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5"></path></svg></a>
        </div>
        <a class="ask" href="#" style="display:flex;align-items:center;gap:6px;font-size:12.5px"><dc-import name="v7c_bot" state="idle" size="18" hint-size="18px,18px"></dc-import>Ask VCFO about this</a>
      </div>
      <div class="dlg-f" style="justify-content:space-between">
        <div style="display:flex;gap:6px"><button type="button" class="ibtn" aria-label="Previous announcement" data-tip="Previous announcement"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg></button><button type="button" class="ibtn" aria-label="Next announcement" data-tip="Next announcement"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></button><span class="mono cap" style="align-self:center">1 / 6</span></div>
        <button type="button" class="btn btn-n">Got it</button>
      </div>
    </div>
  </div>
</div>
```

### 3.6 Notifications

Desktop: 12-column grid (list 9 / side 3). ≤959: list then side cards in an auto-fit grid (min 240). Phone: who · time moves under the body, right column hidden.

#### Notifications page-specific CSS (incl. icon option 4) — `s/team/notif_redesign.dc.html:56-77`

```css
.tb-g12{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}
.tb-s9{grid-column:span 9}.tb-s3{grid-column:span 3;display:flex;flex-direction:column;gap:16px}
@media (max-width:959px){.tb-s9{grid-column:1 / -1}.tb-s3{grid-column:1 / -1;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));align-items:start}}
.tb-hd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--hair);min-width:0}
.tb-tl{display:flex;align-items:center;gap:4px 8px;flex-wrap:wrap;min-width:0}
.dd-top{flex-wrap:wrap}
@media (max-width:767px){.tb-pref{width:40px!important}.nt{padding:11px 0;margin:-11px 0}.udot.pulse{position:relative}.udot.pulse::before{content:"";position:absolute;inset:-16px}.tb-leg{min-height:40px}}
/* the kind chip gets its own column, so the chips line up down the list instead of
   sitting at a different x on every row (104px clears the widest, "Announcement").
   the who/time column needs a fixed width too, or its varying length shifts the chips. */
.nkind{flex:none;width:104px;display:flex;align-items:center}
.tb-d{flex:none;width:168px;text-align:right}
@media (max-width:520px){.nkind{width:auto;justify-content:flex-end}}
</style>
<style>
/* v6 · notification icons: OPTION 4, Lucide glyph in a 32 px pale-tint tile (one renderer, see icon()) + working links in every row */
.nic{position:relative;flex:none;width:32px;height:32px;display:grid;place-items:center;border-radius:8px}
.nt{color:var(--fg);text-decoration:none}.nt:hover{color:var(--primary);text-decoration:underline;text-underline-offset:2px}
.nb{display:block;font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nb a{color:var(--primary);font-weight:600;text-decoration:none}.nb a:hover{text-decoration:underline;text-underline-offset:2px}
.nwho{color:var(--muted);font-weight:500;text-decoration:none}.nwho:hover{color:var(--primary);text-decoration:underline}
</style>
```

#### Notifications markup (list, donut, channel card, toast, drill-down) — `s/team/notif_redesign.dc.html:79-175`

```html
<div class="tb-root">
  <div class="tb-side" data-vp="side"><dc-import name="side" active="1" updates="{{sideCount}}" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="tb-main">
    <dc-import name="topbar" crumb="Notifications" mid="Updates" active="notif" notif="{{unread}}" hint-size="100%,52px" style="display:block;width:100%"></dc-import>
    <main class="pg tb-wrap">

      <div class="tb-g12">
        <section class="card tb-s9">
          <div class="tb-hd">
            <div class="tb-segx"><div class="seg" role="tablist" aria-label="Filter notifications" style="grid-template-columns:repeat(6,minmax(0,1fr))"><span class="thumb" style="width:calc((100% - 4px)/6);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="6"><button type="button" role="tab" aria-selected="{{t.sel}}" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div>
          </div>
          <sc-if value="{{isEmpty}}" hint-placeholder-val="{{false}}">
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:10px;padding:56px 16px 64px">
              <span class="react" style="display:flex;flex:none"><dc-import name="v7c_bot" state="answered" size="52" hint-size="52px,52px"></dc-import></span>
              <div role="status" style="max-width:300px;background:var(--panel);border:1px solid var(--border);border-radius:10px 10px 10px 3px;padding:10px 12px;box-shadow:var(--shadow)">
                <div class="rt" style="font-weight:700">All caught up. Nothing unread.</div>
                <div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button type="button" class="btn btn-o btn-sm" onClick="{{showAll}}">See all</button></div>
              </div>
            </div>
          </sc-if>
          <sc-for list="{{groups}}" as="g" hint-placeholder-count="3">
            <div>
              <div class="lbl" style="padding:12px 16px 6px;color:var(--navy-ink,var(--navy))">{{g.label}}</div>
              <sc-for list="{{g.items}}" as="n" hint-placeholder-count="3">
                <div class="{{n.rowCls}}">
                  <span class="nic" role="img" aria-label="{{n.tipText}}" style="{{n.icSt}}"><svg width="{{n.sz}}" height="{{n.sz}}" viewBox="0 0 24 24" fill="none" stroke="{{n.s1}}" stroke-width="{{n.w1}}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{n.p1}}"></path></svg></span>
                  <div style="flex:1;min-width:0">
                    <span class="tb-tl"><a href="#" class="rt nt" data-go="{{n.go}}" style="{{n.tw}}">{{n.t}}</a></span>
                    <span class="nb"><sc-for list="{{n.parts}}" as="p" hint-placeholder-count="2"><sc-if value="{{p.isLink}}" hint-placeholder-val="{{true}}"><a href="{{p.href}}" target="{{p.tgt}}" rel="noopener" data-go="{{p.go}}">{{p.t}}</a></sc-if><sc-if value="{{p.isText}}" hint-placeholder-val="{{false}}"><span>{{p.t}}</span></sc-if><span>{{p.sep}}</span></sc-for></span>
                    <span class="mono tb-m" style="font-size:11px;color:var(--muted);margin-top:2px"><sc-if value="{{n.whoLink}}" hint-placeholder-val="{{true}}"><a href="#" data-go="{{n.whoGo}}" class="nwho">{{n.who}}</a></sc-if><sc-if value="{{n.whoText}}" hint-placeholder-val="{{false}}">{{n.who}}</sc-if> · {{n.w}}</span>
                  </div>
                  <span class="nkind"><span class="chip" style="{{n.chip}}">{{n.kind}}</span></span>
                  <span class="mono tb-d" style="font-size:11px;color:var(--muted);white-space:nowrap"><sc-if value="{{n.whoLink}}" hint-placeholder-val="{{true}}"><a href="#" data-go="{{n.whoGo}}" class="nwho">{{n.who}}</a></sc-if><sc-if value="{{n.whoText}}" hint-placeholder-val="{{false}}">{{n.who}}</sc-if> · {{n.w}}</span>
                  <sc-if value="{{n.unread}}" hint-placeholder-val="{{true}}"><button type="button" class="udot pulse" aria-label="Unread · mark as read" onClick="{{n.read}}" style="border:0;padding:0;cursor:pointer"></button></sc-if>
                  <sc-if value="{{n.isRead}}" hint-placeholder-val="{{false}}"><span style="width:8px"></span></sc-if>
                  <a href="#" class="ibtn" data-go="{{n.go}}" aria-label="Open {{n.t}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14 M12 5l7 7-7 7"></path></svg></a>
                </div>
              </sc-for>
            </div>
          </sc-for>
        </section>

        <div class="tb-s3">
          <section class="card t" style="padding:16px;gap:12px;align-items:center">
            <h2 class="st" style="align-self:flex-start">This month</h2>
            <div style="position:relative;width:140px;height:140px">
              <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true" style="transform:rotate(-90deg);overflow:visible">
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--raised)" stroke-width="18"></circle>
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--due-chip)" stroke-width="{{s0.w}}" stroke-dasharray="{{s0.da}}" stroke-dashoffset="{{s0.off}}" onMouseEnter="{{s0.enter}}" onMouseLeave="{{leave}}" onClick="{{s0.open}}" style="cursor:pointer;transition:stroke-width .15s"></circle>
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--prog-chip)" stroke-width="{{s1.w}}" stroke-dasharray="{{s1.da}}" stroke-dashoffset="{{s1.off}}" onMouseEnter="{{s1.enter}}" onMouseLeave="{{leave}}" onClick="{{s1.open}}" style="cursor:pointer;transition:stroke-width .15s"></circle>
                <circle cx="70" cy="70" r="54" fill="none" stroke="oklch(70% 0.15 80)" stroke-width="{{s2.w}}" stroke-dasharray="{{s2.da}}" stroke-dashoffset="{{s2.off}}" onMouseEnter="{{s2.enter}}" onMouseLeave="{{leave}}" onClick="{{s2.open}}" style="cursor:pointer;transition:stroke-width .15s"></circle>
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--sky-chip)" stroke-width="{{s3.w}}" stroke-dasharray="{{s3.da}}" stroke-dashoffset="{{s3.off}}" onMouseEnter="{{s3.enter}}" onMouseLeave="{{leave}}" onClick="{{s3.open}}" style="cursor:pointer;transition:stroke-width .15s"></circle>
              </svg>
              <button type="button" onClick="{{openAll}}" onMouseEnter="{{enterAll}}" onMouseLeave="{{leave}}" aria-label="Show all {{total}} notifications" style="position:absolute;inset:26px;border-radius:99px;border:0;background:var(--panel);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font:inherit;color:inherit" data-tip="Show all {{total}} notifications"><span class="metric" style="font-size:30px;line-height:1">{{total}}</span><span class="cap">this month</span></button>
              <sc-if value="{{hasTip}}" hint-placeholder-val="{{false}}"><span role="tooltip" style="position:absolute;left:50%;top:-6px;transform:translate(-50%,-100%);background:var(--navy);color:#fff;font:700 12px Manrope;padding:4px 9px;border-radius:6px;white-space:nowrap;z-index:5;box-shadow:0 6px 16px -6px oklch(21% 0.042 264 / .5)">{{tip}}<span style="position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)"></span></span></sc-if>
            </div>
            <div style="display:flex;flex-direction:column;gap:2px;align-self:stretch">
              <sc-for list="{{legend}}" as="l" hint-placeholder-count="4"><button type="button" class="tb-leg" onClick="{{l.open}}" onMouseEnter="{{l.enter}}" onMouseLeave="{{leave}}" style="display:flex;align-items:center;gap:8px;font:600 12px Manrope;color:var(--fg);border:0;background:none;padding:5px 6px;border-radius:6px;cursor:pointer;text-align:left;{{l.hl}}"><span style="width:10px;height:10px;border-radius:3px;{{l.c}}"></span><span style="flex:1">{{l.k}}</span><span class="mono">{{l.n}}</span></button></sc-for>
            </div>
          </section>
          <section class="card" style="padding:14px 16px;gap:10px">
            <h2 class="h3">Northwind gets these by</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <span class="chip" style="background:var(--prog-light);color:var(--prog-text);padding:4px 8px">✓ Email</span>
              <span class="chip" style="background:var(--ok-light);color:var(--ok-text);padding:4px 8px">✓ WhatsApp</span>
            </div>
            <a href="#" style="font-size:12px">Change in Settings →</a>
          </section>
        </div>
      </div>
    </main>
  </div>
  <sc-if value="{{toast}}" hint-placeholder-val="{{false}}"><div class="toast tb-toast"><span>All marked read</span><a href="#" onClick="{{undo}}">Undo</a></div></sc-if>
  <div class="tb-launch"><dc-import name="launcher" hint-size="160px,130px"></dc-import></div>
  <sc-if value="{{drillOpen}}" hint-placeholder-val="{{false}}">
    <div class="ov tb-ov tb-top">
      <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="nd-t" style="width:600px;display:flex;flex-direction:column"><div class="dd-top" style="display:flex;align-items:center;gap:8px;padding:9px 18px;background:var(--primary-light);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)"><span>{{dLinkLead}}</span><a href="#" data-go="{{dLinkGo}}" onClick="{{dLinkClick}}" style="margin-left:auto;font-weight:800;font-size:12.5px;white-space:nowrap">{{dLinkText}}</a></div>
        <div class="dlg-h">
          <span class="ic" style="background:var(--navy)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg></span>
          <h2 id="nd-t" style="margin:0;font:700 16px Manrope;color:var(--navy-ink,var(--navy))">Notifications this month</h2>
          <button type="button" class="ibtn" aria-label="Close" style="margin-left:auto;border:0" onClick="{{closeDrill}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18 M6 6l12 12"></path></svg></button>
        </div>
        <div style="padding:12px 18px 0"><div class="tb-segx"><div class="seg" role="tablist" aria-label="Filter by type" style="grid-template-columns:repeat(5,minmax(0,1fr))"><span class="thumb" style="width:calc((100% - 4px)/5);{{dthumb}}"></span><sc-for list="{{dtabs}}" as="t" hint-placeholder-count="5"><button type="button" role="tab" aria-selected="{{t.sel}}" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div></div>
        <div style="padding:8px 0 10px;max-height:min(420px,52dvh);overflow:auto">
          <sc-for list="{{dItems}}" as="n" hint-placeholder-count="4">
            <a href="#" class="row" data-go="{{n.go}}" style="color:inherit;font-weight:inherit;padding:10px 18px">
              <span class="nic" role="img" aria-label="{{n.tipText}}" style="{{n.icSt}}"><svg width="{{n.sz}}" height="{{n.sz}}" viewBox="0 0 24 24" fill="none" stroke="{{n.s1}}" stroke-width="{{n.w1}}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{n.p1}}"></path></svg></span>
              <span style="flex:1;min-width:0"><span class="rt" style="display:block">{{n.t}}</span><span class="mono cap">{{n.who}} · {{n.w}}</span></span>
              <span class="chip" style="{{n.chip}}">{{n.kind}}</span>
              <span style="color:var(--primary);display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14 M12 5l7 7-7 7"></path></svg></span>
            </a>
          </sc-for>
        </div>
      </div>
    </div>
  </sc-if>
</div>
```

#### Notifications logic (icon set, types, demo rows, filters, donut maths, drill links) — `s/team/notif_redesign.dc.html:177-281`

```js
<script type="text/x-dc" data-dc-script data-props='{"tab":{"editor":"enum","options":[0,1,2,3,4,5],"default":0},"allRead":{"editor":"boolean","default":false},"drill":{"editor":"enum","options":["",0,1,2,3,4],"default":""},"$preview":{"width":1440,"height":1000}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {}; }
  renderVals() {
    const s = this.state;
    const tab = s.tab !== undefined ? s.tab : Number(this.props.tab ?? 0);
    /* ====== notification icons: OPTION 4 (owner pick). Lucide 2 px glyph in a 32 px pale-tint tile, one glyph and one colour per type.
       Glyphs are Lucide's own geometry (24 px grid, stroke 2, round caps and joins), merged into one path each.
       To try another set: add a SETS entry and change ICON_SET. ====== */
    const ICON_SET = 'OPTION4';
    const SETS = {
      OPTION4: {
        document: { p1: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z M14 2v5a1 1 0 0 0 1 1h5 M10 9H8 M16 13H8 M16 17H8", col: 'oklch(54.6% 0.215 263)', tint: 'light-dark(oklch(96.6% 0.02 260), oklch(24% 0.058 260))' },      // file-text
        step: { p1: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M16 9l-5.5 5.5L8 12", col: 'oklch(56% 0.13 168)', tint: 'light-dark(oklch(96% 0.028 170), oklch(24.4% 0.077 170))' },          // circle-check
        deadline: { p1: "M16 14v2.2l1.6 1 M16 2v3 M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338 M3 9h5.859 M8 2v3 M10 16a6 6 0 1 0 12 0a6 6 0 1 0 -12 0", col: 'oklch(55% 0.17 42)', tint: 'light-dark(oklch(96.8% 0.04 55), oklch(23.9% 0.106 55))' },     // calendar-clock
        email: { p1: "M22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7 M4 4H20a2 2 0 0 1 2 2V18a2 2 0 0 1 -2 2H4a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2z", col: 'oklch(54% 0.17 292)', tint: 'light-dark(oklch(96.4% 0.032 292), oklch(24.2% 0.087 292))' },               // mail
        announcement: { p1: "M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14 M8 6v8", col: 'oklch(52% 0.17 40)', tint: 'light-dark(oklch(96.6% 0.04 45), oklch(24% 0.106 45))' },      // megaphone
        team: { p1: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3.128a4 4 0 0 1 0 7.744 M22 21v-2a4 4 0 0 0-3-3.87 M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0", col: 'oklch(49% 0.12 230)', tint: 'light-dark(oklch(96.4% 0.026 228), oklch(24.2% 0.072 228))' }                // users
      }
    };
    const K = SETS[ICON_SET];
    // notification kinds → icon type, filter group, chip, tooltip
    const T = {
      doc: ['document', 'Documents', 'Request', 'background:var(--due-light);color:var(--due-text)', 'Document request'],
      back: ['document', 'Documents', 'Sent back', 'background:var(--over-light);color:var(--over-text)', 'Document sent back · fix needed'],
      step: ['step', 'Steps', 'Step', 'background:var(--ok-light);color:var(--ok-text)', 'Step done'],
      time: ['step', 'Steps', 'Timeline', 'background:var(--prog-light);color:var(--prog-text)', 'Timeline changed'],
      deadline: ['deadline', 'Deadlines', 'Deadline', 'background:light-dark(oklch(96.8% 0.05 85), oklch(23.9% 0.12 85));color:light-dark(oklch(45% 0.12 70), oklch(82% 0.084 70))', 'Deadline coming up'],
      mail: ['email', 'Messages', 'Email', 'background:var(--sky-light);color:var(--sky-chip)', 'Email sent to Northwind'],
      ann: ['announcement', 'Messages', 'Announcement', 'background:light-dark(oklch(96.6% 0.04 55), oklch(24% 0.106 55));color:light-dark(oklch(48% 0.15 42), oklch(80.8% 0.105 42))', 'Announcement'],
      team: ['team', 'Messages', 'Team', 'background:light-dark(oklch(96.5% 0.03 230), oklch(24.1% 0.082 230));color:light-dark(oklch(45% 0.11 235), oklch(82% 0.077 235))', 'Team change']
    };
    // one renderer for every set: tile background = tint, glyph stroke = type colour
    const icon = (ty) => {
      const k = K[T[ty][0]];
      return { p1: k.p1, sz: 18, s1: k.col, w1: 2, icSt: 'background:' + k.tint };
    };
    const N = [
      { id: 1, g: 0, ty: 'doc', t: '2 documents requested', b: [['Utility bill for the office', 'inc-step-7'], ['Board resolution', 'board-resolution']], who: 'Arjun Mehta', ini: 'AM', w: '10:42', u: true, go: 'documents' },
      { id: 2, g: 0, ty: 'back', t: 'Passport copy sent back', b: [['Photo page is blurred. Please upload again.', ''], ['Open the document', 'doc-viewer']], who: 'Arjun Mehta', ini: 'AM', w: '09:15', u: true, go: 'documents' },
      { id: 3, g: 0, ty: 'deadline', t: 'GSTR-1 due in 3 days', b: [['Sun 11 Oct · GST', 'filings'], ['GST portal ↗', 'https://www.gst.gov.in']], who: 'VCFO Suite', ini: 'VS', w: '09:00', u: false, go: 'filings' },
      { id: 4, g: 0, ty: 'time', t: 'Phase 2 end date moved to 28 Oct', b: [['Approved by Priya Raman', 'team'], ['See the timeline', 'home']], who: 'Priya Raman', ini: 'PR', w: '08:30', u: true, go: 'inc-phase' },
      { id: 5, g: 1, ty: 'step', t: 'Capital Structure accepted', b: [['Step 6 of 14 is complete', 'inc-step-6']], who: 'Priya Raman', ini: 'PR', w: 'Tue 6 Oct', u: false, go: 'inc-step-6' },
      { id: 6, g: 1, ty: 'step', t: 'Name approved by MCA', b: [['NORTHWIND TECHNOLOGIES INDIA PRIVATE LIMITED', ''], ['Name approval letter', 'doc-viewer']], who: 'Arjun Mehta', ini: 'AM', w: 'Tue 6 Oct', u: false, go: 'inc-step-5' },
      { id: 7, g: 1, ty: 'ann', t: 'MCA V3 portal down 11–12 Oct', b: [['Official feed', 'announcements'], ['mca.gov.in ↗', 'https://www.mca.gov.in']], who: 'SBC', ini: 'SBC', w: 'Wed 7 Oct', u: false, go: 'announcements' },
      { id: 8, g: 1, ty: 'mail', t: 'Email sent: Documents requested', b: [['To rahul@northwind.in', ''], ['Email settings', 'settings']], who: 'VCFO Suite', ini: 'VS', w: 'Tue 6 Oct', u: false, go: 'documents' },
      { id: 9, g: 2, ty: 'team', t: 'Meera Iyer joined the project', b: [['Director · invited by Northwind', 'team']], who: 'Meera Iyer', ini: 'MI', w: '2 Oct', u: false, go: 'team' },
      { id: 10, g: 2, ty: 'step', t: 'DIN allotted to both directors', b: [['Rahul Khanna · Meera Iyer', ''], ['Step 4 · DIN', 'inc-step-4']], who: 'Arjun Mehta', ini: 'AM', w: '29 Sep', u: false, go: 'inc-step-4' },
      { id: 11, g: 2, ty: 'mail', t: 'Email sent: Welcome to VCFO Suite', b: [['To rahul@northwind.in', ''], ['Open Home', 'home']], who: 'VCFO Suite', ini: 'VS', w: '2 Sep', u: false, go: 'home' }
    ];
    const PEOPLE = { 'Arjun Mehta': 1, 'Priya Raman': 1, 'Meera Iyer': 1 };
    const parts = (n) => n.b.map((p, i) => ({ t: p[0], go: /^https?:/.test(p[1]) ? '' : p[1], href: /^https?:/.test(p[1]) ? p[1] : '#', tgt: /^https?:/.test(p[1]) ? '_blank' : '_self', isLink: !!p[1], isText: !p[1], sep: i < n.b.length - 1 ? ' · ' : '' }));
    const read = s.read || {};
    const allRead = s.allRead !== undefined ? s.allRead : Boolean(this.props.allRead);
    const isU = (n) => n.u && !allRead && !read[n.id];
    const unread = N.filter(isU).length;
    const grp = (n) => T[n.ty][1];
    const TABS = [['All', () => true], ['Unread', isU], ['Documents', (n) => grp(n) === 'Documents'], ['Steps', (n) => grp(n) === 'Steps'], ['Deadlines', (n) => grp(n) === 'Deadlines'], ['Messages', (n) => grp(n) === 'Messages']];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: N.filter(t[1]).length, cls: tab === i ? 'on' : '', sel: tab === i ? 'true' : 'false', pick: () => this.setState({ tab: i }) }));
    const shown = N.filter(TABS[tab][1]);
    const decorate = (n) => Object.assign({}, n, icon(n.ty), { kind: T[n.ty][2], chip: T[n.ty][3], tipText: T[n.ty][4], parts: parts(n), whoGo: PEOPLE[n.who] ? 'team' : '', whoLink: !!PEOPLE[n.who], whoText: !PEOPLE[n.who] });
    const GL = ['Today', 'Earlier this week', 'Earlier'];
    const groups = GL.map((label, gi) => ({ label, items: shown.filter((n) => n.g === gi).map((n) => {
      const u = isU(n);
      return Object.assign(decorate(n), { unread: u, isRead: !u, rowCls: u ? 'row unread' : 'row', tw: u ? 'font-weight:800;color:var(--fg)' : 'font-weight:600;color:var(--fg)',
        read: () => this.setState({ read: Object.assign({}, read, { [n.id]: true }) }) });
    }) })).filter((g) => g.items.length);
    const cnt = (k) => N.filter((n) => grp(n) === k).length;
    const tot = N.length;
    // rule 14: hover → tooltip, click → drill-down pop-up with the clicked type pre-selected
    const DT = ['All', 'Documents', 'Steps', 'Deadlines', 'Messages'];
    const pd = this.props.drill;
    const drill = s.drill !== undefined ? s.drill : (pd === undefined || pd === null || pd === '' ? null : Number(pd));
    const hv = s.hv;
    const C = 2 * Math.PI * 54;
    let acc = 0;
    const seg = (i) => {
      const k = DT[i + 1], len = cnt(k) / tot * C, on = hv === i + 1;
      const out = { w: on ? 24 : 18, da: Math.max(len - 2, 0) + ' ' + (C - len + 2), off: -acc,
        enter: () => this.setState({ hv: i + 1 }), open: () => this.setState({ drill: i + 1, hv: undefined }) };
      acc += len; return out;
    };
    const s0 = seg(0), s1 = seg(1), s2 = seg(2), s3 = seg(3);
    const LC = ['background:var(--due-chip)', 'background:var(--prog-chip)', 'background:oklch(70% 0.15 80)', 'background:var(--sky-chip)'];
    const legend = [1, 2, 3, 4].map((i) => ({ k: DT[i], n: cnt(DT[i]), c: LC[i - 1], hl: hv === i ? 'background:var(--raised)' : '',
      enter: () => this.setState({ hv: i }), open: () => this.setState({ drill: i, hv: undefined }) }));
    const hasTip = hv !== undefined && hv !== null;
    const tip = hasTip ? (hv === 0 ? 'All · ' + tot : DT[hv] + ' · ' + cnt(DT[hv])) : '';
    const dtabs = DT.map((l, i) => ({ label: l, cnt: i === 0 ? tot : cnt(l), cls: drill === i ? 'on' : '', sel: drill === i ? 'true' : 'false', pick: () => this.setState({ drill: i }) }));
    const dItems = drill === null ? [] : N.filter((n) => drill === 0 || grp(n) === DT[drill]).map(decorate);
    const LINK = [['These live in Northwind’s Notifications list', 'Show in the list ↓', ''], ['These items live in Documents', 'Open Documents →', 'documents'], ['These steps live in Incorporation', 'Open Incorporation →', 'incorporation'], ['These deadlines live in Compliances · Filings', 'Open Filings →', 'filings'], ['These messages live in Announcements', 'Open Announcements →', 'announcements']][drill || 0];
    return {
      tabs, groups, unread, sideCount: unread, isEmpty: groups.length === 0,
      thumb: 'transform:translateX(' + (tab * 100) + '%)',
      total: tot, s0, s1, s2, s3, legend, hasTip, tip,
      leave: () => this.setState({ hv: undefined }),
      enterAll: () => this.setState({ hv: 0 }), openAll: () => this.setState({ drill: 0, hv: undefined }),
      drillOpen: drill !== null, dtabs, dItems, dthumb: 'transform:translateX(' + ((drill || 0) * 100) + '%)',
      closeDrill: () => this.setState({ drill: null }), dLinkLead: LINK[0], dLinkText: LINK[1], dLinkGo: LINK[2], dLinkClick: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ drill: null }); setTimeout(() => window.scrollTo({ top: 200, behavior: 'smooth' }), 60); },
      toast: Boolean(s.toast),
      markAll: () => this.setState({ allRead: true, toast: true }),
      undo: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ allRead: false, toast: false, read: {} }); },
      showAll: () => this.setState({ tab: 0 })
    };
  }
```

### 3.7 Audit

Desktop: header actions, 14-day bar card, filters + day-grouped timeline. ≤959: narrower columns. Phone: day header horizontal, who on a second line.

#### Audit page-specific CSS — `s/team/audit_redesign.dc.html:56-81`

```css
.tb-srch{position:relative;display:block;flex:0 1 240px;width:240px;max-width:100%;min-width:150px}
.tb-14{display:grid;grid-template-columns:repeat(14,minmax(0,1fr));gap:6px}
.tb-hd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--hair);flex-wrap:wrap}
.tb-hd .tb-segx+.tb-segx{margin-left:auto}
.tb-day{display:grid;grid-template-columns:72px minmax(0,1fr);gap:16px;padding-top:14px}
.tb-vl{position:absolute;left:79px;top:14px;bottom:14px;width:2px;background:var(--border)}
.tb-ev{display:grid;grid-template-columns:52px 28px minmax(0,1fr) 190px 32px;gap:12px;align-items:center;padding:8px 0}
.tb-facts{position:relative;margin:0 0 8px 92px;padding:12px 14px;border-radius:8px;background:var(--raised);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 16px}
.tb-facts .rt{overflow-wrap:anywhere}
.dd-top{flex-wrap:wrap}
@media (max-width:959px){.tb-ev{grid-template-columns:48px 28px minmax(0,1fr) 150px 32px;gap:10px}.tb-vl{left:71px}.tb-facts{margin-left:86px}}
@media (max-width:767px){
  .tb-14{gap:3px}
  .tb-hd .tb-segx+.tb-segx{margin-left:0}
  .tb-day{grid-template-columns:minmax(0,1fr);gap:4px}
  .tb-dayh{display:flex;align-items:center;gap:10px}
  .tb-dayh .dtile{width:50px!important;height:52px!important}
  .tb-dayh .cap{width:auto!important;margin:0!important;font-size:12px}
  .tb-ev{grid-template-columns:44px 28px minmax(0,1fr) 40px;gap:4px 10px}
  .tb-evw{grid-column:3 / -1;grid-row:2}
  .tb-vl{left:67px}
  .tb-facts{margin-left:0;grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
  .ph .acts{flex:1 1 100%}
  .tb-srch{flex:1 1 150px;width:auto;max-width:none}
}
</style>
```

#### Audit markup (search/export, 14-day bars, filters, timeline, facts, drill-down) — `s/team/audit_redesign.dc.html:83-174`

```html
<div class="tb-root">
  <div class="tb-side" data-vp="side"><dc-import name="side" active="7" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="tb-main">
    <dc-import name="topbar" crumb="Audit" hint-size="100%,52px" style="display:block;width:100%"></dc-import>
    <main class="pg tb-wrap">
      <div class="ph">
        <div class="acts">
          <label class="tb-srch"><span style="position:absolute;left:10px;top:10px;color:var(--subtle)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg></span><input class="inp" aria-label="Search the audit log" placeholder="Search" style="padding-left:32px"></label>
          <button type="button" class="btn btn-o"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg>Export</button>
        </div>
      </div>

      <section class="card t" style="padding:14px 18px 12px;gap:10px">
        <div style="display:flex;align-items:center;gap:10px"><h2 class="st">Last 14 days</h2><span class="metric" style="font-size:20px;margin-left:auto">{{total}}</span><span class="cap">events</span></div>
        <div class="tb-14" style="position:relative;align-items:end;height:64px">
          <sc-for list="{{bars}}" as="b" hint-placeholder-count="14"><button type="button" onClick="{{b.open}}" onMouseEnter="{{b.enter}}" onMouseLeave="{{leave}}" disabled="{{b.empty}}" aria-label="{{b.tip}}" style="display:flex;flex-direction:column;justify-content:flex-end;height:100%;padding:0;border:0;background:none;cursor:pointer" data-tip="{{b.tip}}"><span style="display:block;width:100%;border-radius:3px 3px 0 0;transform-origin:bottom;animation:grow .9s cubic-bezier(.2,.7,.2,1) backwards;transition:opacity .15s;{{b.h}}"></span></button></sc-for>
          <sc-if value="{{hasTip}}" hint-placeholder-val="{{false}}"><span role="tooltip" style="position:absolute;bottom:calc(100% + 4px);transform:translateX(-50%);background:var(--navy);color:#fff;font:700 12px Manrope;padding:4px 9px;border-radius:6px;white-space:nowrap;z-index:5;pointer-events:none;box-shadow:0 6px 16px -6px oklch(21% 0.042 264 / .5);{{tipPos}}">{{tip}}<span style="position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)"></span></span></sc-if>
        </div>
        <div class="tb-14"><sc-for list="{{bars}}" as="b" hint-placeholder-count="14"><span class="mono" style="font-size:11px;text-align:center;{{b.lc}}">{{b.d}}</span></sc-for></div>
      </section>

      <section class="card">
        <div class="tb-hd">
          <div class="tb-segx"><div class="seg" role="tablist" aria-label="Filter by type" style="grid-template-columns:repeat({{nT}},minmax(0,1fr))"><span class="thumb" style="width:calc((100% - 4px)/{{nT}});{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="6"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div>
          <div class="tb-segx"><div class="seg" role="tablist" aria-label="Filter by who" style="grid-template-columns:repeat(3,minmax(0,1fr))"><span class="thumb" style="width:calc((100% - 4px)/3);{{wthumb}}"></span><sc-for list="{{whos}}" as="t" hint-placeholder-count="3"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}</button></sc-for></div></div>
        </div>
        <div style="padding:6px 16px 16px">
          <sc-if value="{{noDays}}" hint-placeholder-val="{{false}}">
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:10px;padding:40px 16px 24px">
              <span style="display:flex;flex:none"><dc-import name="v7c_bot" state="idle" size="48" hint-size="48px,48px"></dc-import></span>
              <div role="status" style="max-width:300px;background:var(--panel);border:1px solid var(--border);border-radius:10px 10px 10px 3px;padding:10px 12px;box-shadow:var(--shadow)">
                <div class="rt" style="font-weight:700">Nothing matches these filters yet.</div>
                <div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button type="button" class="btn btn-o btn-sm" onClick="{{clearFilters}}">Clear filters</button><a href="#" style="font-size:12px">Ask VCFO why</a></div>
              </div>
            </div>
          </sc-if>
          <sc-for list="{{days}}" as="d" hint-placeholder-count="3">
            <div class="tb-day">
              <div class="tb-dayh"><div class="dtile" style="width:60px;height:62px;{{d.tile}}"><span class="d">{{d.n}}</span><span class="m">{{d.m}}</span></div><div class="cap" style="text-align:center;width:60px;margin-top:4px;font-weight:700">{{d.wd}}</div></div>
              <div style="position:relative">
                <span class="tb-vl"></span>
                <sc-for list="{{d.items}}" as="e" hint-placeholder-count="3">
                  <div>
                    <div class="tb-ev">
                      <span class="mono" style="font-size:12px;font-weight:600;color:var(--navy-ink,var(--navy))">{{e.t}}</span>
                      <span class="node" data-tip="{{e.tipText}}" aria-label="{{e.tipText}}" role="img" style="{{e.bg}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{e.icon}}" fill="{{e.fill}}"></path></svg></span>
                      <div style="min-width:0"><span class="rt" style="font-weight:700">{{e.a}}</span><span style="color:var(--muted)"> · {{e.s}}</span></div>
                      <div class="tb-evw" style="display:flex;align-items:center;gap:8px;min-width:0"><span class="av" style="width:24px;height:24px;font-size:11px;box-shadow:none;{{e.av}}">{{e.ini}}</span><span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{e.who}}</span><span class="chip" style="{{e.rc}}">{{e.role}}</span></div>
                      <button type="button" class="ibtn" onClick="{{e.toggle}}" aria-expanded="{{e.exp}}" aria-label="Details" data-tip="Details"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="{{e.rot}}"><path d="M6 9l6 6 6-6"></path></svg></button>
                    </div>
                    <sc-if value="{{e.open}}" hint-placeholder-val="{{false}}">
                      <div class="tb-facts">
                        <sc-for list="{{e.facts}}" as="f" hint-placeholder-count="3"><div><div class="lbl">{{f.k}}</div><div class="rt" style="margin-top:3px">{{f.v}}</div></div></sc-for>
                        <div style="grid-column:1 / -1;display:flex;gap:8px"><a href="#" class="btn btn-o btn-sm">{{e.cta}}</a></div>
                      </div>
                    </sc-if>
                  </div>
                </sc-for>
              </div>
            </div>
          </sc-for>
          <div style="display:flex;justify-content:center;padding-top:16px"><button type="button" class="btn btn-o btn-sm">Load older</button></div>
        </div>
      </section>
    </main>
  </div>
  <div class="tb-launch"><dc-import name="launcher" hint-size="160px,130px"></dc-import></div>
  <sc-if value="{{drillOpen}}" hint-placeholder-val="{{false}}">
    <div class="ov tb-ov tb-top">
      <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="ab-t" style="width:760px"><div class="dd-top" style="display:flex;align-items:center;gap:8px;padding:9px 18px;background:var(--primary-light);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)"><span>{{dLinkLead}}</span><a href="#" data-go="{{dLinkGo}}" onClick="{{dLinkClick}}" style="margin-left:auto;font-weight:800;font-size:12.5px;white-space:nowrap">{{dLinkText}}</a></div>
        <div class="dlg-h">
          <div class="dtile" style="background:var(--navy);color:#fff"><span class="d">{{dDay}}</span><span class="m">{{dMon}}</span></div>
          <div style="flex:1;min-width:0"><h2 id="ab-t" style="margin:0;font:700 16px Manrope;color:var(--navy-ink,var(--navy))">{{dTitle}}</h2><div class="cap">{{dCount}}</div></div>
          <button type="button" class="ibtn" aria-label="Close" style="border:0" onClick="{{closeDrill}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
        </div>
        <div style="padding:12px 18px 0"><div class="tb-segx"><div class="seg" role="tablist" aria-label="Pick a day" style="grid-template-columns:repeat({{dN}},minmax(0,1fr))"><span class="thumb" style="width:calc((100% - 4px)/{{dN}});{{dthumb}}"></span><sc-for list="{{dtabs}}" as="t" hint-placeholder-count="10"><button type="button" role="tab" aria-selected="{{t.sel}}" onClick="{{t.pick}}" class="{{t.cls}}" style="padding:0 8px">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div></div>
        <div style="padding:8px 0 10px;max-height:min(420px,52dvh);overflow:auto">
          <sc-for list="{{dItems}}" as="e" hint-placeholder-count="3">
            <a href="#" class="row" style="color:inherit;font-weight:inherit;padding:10px 18px">
              <span class="mono" style="width:44px;font-size:12px;font-weight:600;color:var(--navy-ink,var(--navy))">{{e.t}}</span>
              <span class="node" data-tip="{{e.tipText}}" aria-label="{{e.tipText}}" role="img" style="box-shadow:none;{{e.bg}}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{e.icon}}" fill="{{e.fill}}"></path></svg></span>
              <span style="flex:1;min-width:0"><span class="rt" style="font-weight:700">{{e.a}}</span><span style="color:var(--muted)"> · {{e.s}}</span><span class="cap tb-m tb-flex" style="margin-top:3px;align-items:center;gap:6px"><span style="font-weight:600;color:var(--fg)">{{e.who}}</span><span class="chip" style="{{e.rc}}">{{e.role}}</span></span></span>
              <span class="tb-d" style="font-size:12px;font-weight:600;white-space:nowrap">{{e.who}}</span>
              <span class="chip tb-d" style="{{e.rc}}">{{e.role}}</span>
              <span style="color:var(--primary);display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7 M9 7h8v8"></path></svg></span>
            </a>
          </sc-for>
        </div>
      </div>
    </div>
  </sc-if>
</div>
```

#### Audit logic (glyphs, colours, people/roles, demo events, bars, drill-down) — `s/team/audit_redesign.dc.html:176-259`

```js
<script type="text/x-dc" data-dc-script data-props='{"tab":{"editor":"enum","options":[0,1,2,3,4],"default":0},"openId":{"editor":"int","default":0},"drillDay":{"editor":"enum","options":["",13,12,11,10],"default":""},"$preview":{"width":1440,"height":1200}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {}; }
  renderVals() {
    const s = this.state;
    const tab = s.tab !== undefined ? s.tab : Number(this.props.tab ?? 0);
    const who = s.who || 0;
    const openId = s.openId !== undefined ? s.openId : Number(this.props.openId ?? 0);
    // rule 18: status = set A solid glyphs
    const IC = { req: 'M12 5.2a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8Z M5.8 19.2a6.2 6.2 0 0 1 12.4 0Z', back: 'M12 6.5v7 M12 17.3h.01', up: 'M5.5 16 10 11.5l3 3 5.5-5.5 M14.5 9H18.5V13', ok: 'M6.5 12.5 10.5 16.5 17.5 8.5', time: 'M5.5 16 10 11.5l3 3 5.5-5.5 M14.5 9H18.5V13', mail: 'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5', team: 'M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M18 8v6 M15 11h6' };
    const TIP = { req: 'Waiting on Northwind', back: 'Sent back · fix needed', up: 'With SBC · to review', ok: 'Done', time: 'With SBC · timeline', mail: 'Email', team: 'Team change' };
    const BG = { req: 'background:oklch(66% 0.17 55)', back: 'background:var(--over-chip)', up: 'background:oklch(55% 0.2 262)', ok: 'background:oklch(58% 0.15 155)', time: 'background:oklch(55% 0.2 262)', mail: 'background:var(--sky-chip)', team: 'background:var(--navy)' };
    const PEOPLE = {
      'Arjun Mehta': ['AM', 'background:oklch(55% 0.09 200)', 'Lead', 'sbc'], 'Priya Raman': ['PR', 'background:oklch(62% 0.08 40)', 'Manager', 'sbc'],
      'Meera Iyer': ['MI', 'background:oklch(52% 0.13 330)', 'Client', 'you'], 'Northwind': ['RK', 'background:var(--primary-fill,var(--primary))', 'Client', 'you'], 'VCFO Suite': ['VS', 'background:var(--up);color:var(--fg)', 'System', 'sbc']
    };
    const E = [
      { id: 1, day: 0, t: '10:42', ty: 'req', c: 'Documents', a: 'Documents requested', s: 'Utility bill, Board resolution', who: 'Arjun Mehta', facts: [['Items', '2'], ['Due', '12 Oct'], ['Step', '4 · Registered office']], cta: 'Open request' },
      { id: 2, day: 0, t: '09:15', ty: 'back', c: 'Documents', a: 'Document sent back', s: 'Passport copy', who: 'Arjun Mehta', facts: [['Reason', 'Photo page is blurred'], ['Uploaded by', 'Meera Iyer'], ['File', 'passport_meera.pdf']], cta: 'Upload again' },
      { id: 3, day: 0, t: '08:30', ty: 'time', c: 'Milestones', a: 'Timeline change approved', s: 'Phase 2 ends 28 Oct', who: 'Priya Raman', facts: [['Before', '24 Oct'], ['After', '28 Oct'], ['Slipped', '4 days']], cta: 'View timeline' },
      { id: 4, day: 1, t: '18:20', ty: 'up', c: 'Documents', a: 'Document uploaded', s: 'Passport copy', who: 'Meera Iyer', facts: [['File', 'passport_meera.pdf'], ['Size', '240 KB'], ['Step', '3 · Director KYC']], cta: 'Preview file' },
      { id: 5, day: 1, t: '16:05', ty: 'time', c: 'Milestones', a: 'Change request sent', s: 'Phase 2 +4 days', who: 'Northwind', facts: [['Reason', 'Directors travelling'], ['Asked', '24 → 28 Oct'], ['Status', 'Approved']], cta: 'View timeline' },
      { id: 6, day: 1, t: '11:30', ty: 'mail', c: 'Email', a: 'Email sent', s: 'Documents requested', who: 'VCFO Suite', facts: [['To', 'Northwind'], ['Status', 'Delivered'], ['Also sent', 'WhatsApp nudge']], cta: 'View email' },
      { id: 7, day: 2, t: '15:10', ty: 'ok', c: 'Milestones', a: 'Step accepted', s: 'Capital Structure', who: 'Priya Raman', facts: [['Step', '6 of 14'], ['Submitted', '4 Oct'], ['Turnaround', '2 days']], cta: 'Open step' },
      { id: 8, day: 2, t: '12:00', ty: 'team', c: 'Team', a: 'Colleague invited', s: 'Ananya Rao', who: 'Northwind', facts: [['Invited', 'Ananya Rao'], ['Access', 'Member'], ['Status', 'Invite sent']], cta: 'Open Team' }
    ];
    const credsRows = () => { try { return (JSON.parse(localStorage.getItem('vcfo.credsAudit')) || []).map((r, i) => { const d = new Date(r.t); return { id: 500 + i, day: 0, t: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), ty: 'ok', c: 'Credentials', a: r.x, s: 'Credentials access log', who: 'Northwind', facts: [], cta: 'Open Credentials' }; }); } catch (e) { return []; } };
    E.push(...credsRows());
    const DAYS = [['8', 'Oct', 'Today', 'background:var(--navy);color:#fff'], ['7', 'Oct', 'Wed', 'background:var(--primary-light);color:var(--navy)'], ['6', 'Oct', 'Tue', 'background:var(--primary-light);color:var(--navy)']];
    const CATS = ['All', 'Documents', 'Milestones', 'Team', 'Email', 'Credentials'];
    const WHO = ['Everyone', 'SBC', 'Northwind'];
    const fc = (e) => tab === 0 || e.c === CATS[tab];
    const fw = (e) => who === 0 || PEOPLE[e.who][3] === (who === 1 ? 'sbc' : 'you');
    const tabs = CATS.map((l, i) => ({ label: l, cnt: E.filter((e) => (i === 0 || e.c === l) && fw(e)).length, cls: tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const whos = WHO.map((l, i) => ({ label: l, cls: who === i ? 'on' : '', pick: () => this.setState({ who: i }) }));
    const days = DAYS.map((d, di) => ({ n: d[0], m: d[1], wd: d[2], tile: d[3], items: E.filter((e) => e.day === di && fc(e) && fw(e)).map((e) => {
      const p = PEOPLE[e.who]; const open = openId === e.id;
      return { ...e, bg: BG[e.ty], icon: IC[e.ty], fill: e.ty === 'req' ? 'currentColor' : 'none', tipText: TIP[e.ty], ini: p[0], av: p[1], role: p[2],
        rc: p[3] === 'sbc' ? 'background:var(--navy);color:#fff' : 'background:var(--gold-soft);color:var(--gold-text)',
        open, exp: open ? 'true' : 'false', rot: open ? 'transform:rotate(180deg)' : '',
        facts: e.facts.map((f) => ({ k: f[0], v: f[1] })),
        toggle: () => this.setState({ openId: open ? 0 : e.id }) };
    }) })).filter((d) => d.items.length);
    // rule 14: the 14-day strip. Hover a bar → tooltip; click → that day's events, day pill pre-selected.
    const L = ['25', '26', '27', '28', '29', '30', '1', '2', '3', '4', '5', '6', '7', '8'];
    const M = ['Sep', 'Sep', 'Sep', 'Sep', 'Sep', 'Sep', 'Oct', 'Oct', 'Oct', 'Oct', 'Oct', 'Oct', 'Oct', 'Oct'];
    const WD = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    const OLD = [
      [10, '17:40', 'up', 'Document uploaded', 'Board resolution draft', 'Northwind'], [10, '10:05', 'ok', 'Step accepted', 'Registered office', 'Priya Raman'],
      [7, '14:30', 'req', 'Documents requested', 'Director PAN, Aadhaar', 'Arjun Mehta'],
      [7, '16:10', 'up', 'Document uploaded', 'PAN card', 'Northwind'], [7, '11:20', 'mail', 'Email sent', 'Step 5 accepted', 'VCFO Suite'],
      [6, '18:00', 'ok', 'Step accepted', 'Director KYC', 'Priya Raman'], [6, '15:45', 'up', 'Document uploaded', 'Aadhaar card', 'Meera Iyer'], [6, '09:30', 'team', 'Colleague added', 'Dev Sharma', 'Northwind'],
      [4, '12:15', 'ok', 'Name approved', 'MCA RUN', 'Arjun Mehta'],
      [3, '16:50', 'time', 'Timeline set', 'Phase 2 ends 24 Oct', 'Priya Raman'], [3, '10:00', 'mail', 'Email sent', 'Welcome to Phase 2', 'VCFO Suite'],
      [0, '11:00', 'req', 'Documents requested', 'Proof of address', 'Arjun Mehta']
    ];
    const ALL = E.map((e) => ({ ...e, di: 13 - e.day })).concat(OLD.map((o, k) => ({ id: 100 + k, di: o[0], t: o[1], ty: o[2], a: o[3], s: o[4], who: o[5] })));
    const H = L.map((_, i) => ALL.filter((e) => e.di === i).length);
    const hv = s.hv;
    const pd = this.props.drillDay;
    const dd = s.dd !== undefined ? s.dd : (pd === undefined || pd === null || pd === '' ? null : Number(pd));
    const bars = H.map((h, i) => ({ d: L[i], empty: h === 0, tip: WD[i] + ' ' + L[i] + ' ' + M[i] + ' · ' + h + (h === 1 ? ' event' : ' events'),
      h: 'height:' + Math.max(h * 14, 3) + 'px;background:' + (i === 13 ? 'var(--navy)' : h ? 'var(--navy-3)' : 'var(--border)') + ';opacity:' + (i === 13 || hv === i ? 1 : .55),
      lc: i === 13 ? 'color:var(--navy-ink,var(--navy));font-weight:700' : 'color:var(--subtle)',
      enter: () => this.setState({ hv: i }), open: () => { if (h) this.setState({ dd: i, hv: undefined }); } }));
    const hasTip = hv !== undefined && hv !== null;
    const active = L.map((_, i) => i).filter((i) => H[i] > 0).reverse();
    const dtabs = active.map((i) => ({ label: L[i] + ' ' + M[i], cnt: H[i], cls: dd === i ? 'on' : '', sel: dd === i ? 'true' : 'false', pick: () => this.setState({ dd: i }) }));
    const pos = Math.max(active.indexOf(dd), 0);
    const dItems = dd === null ? [] : ALL.filter((e) => e.di === dd).map((e) => {
      const p = PEOPLE[e.who];
      return { ...e, bg: BG[e.ty], icon: IC[e.ty], fill: e.ty === 'req' ? 'currentColor' : 'none', tipText: TIP[e.ty], role: p[2], rc: p[3] === 'sbc' ? 'background:var(--navy);color:#fff' : 'background:var(--gold-soft);color:var(--gold-text)' };
    });
    return { tabs, whos, days, bars, nT: CATS.length, total: ALL.length, noDays: days.length === 0,
      clearFilters: () => this.setState({ tab: 0, who: 0 }),
      thumb: 'transform:translateX(' + (tab * 100) + '%)', wthumb: 'transform:translateX(' + (who * 100) + '%)',
      hasTip, tip: hasTip ? bars[hv].tip : '', tipPos: hasTip ? 'left:calc(' + ((hv + 0.5) / 14 * 100) + '% )' : '',
      leave: () => this.setState({ hv: undefined }),
      drillOpen: dd !== null, dtabs, dN: active.length, dthumb: 'transform:translateX(' + (pos * 100) + '%)', dItems,
      dDay: dd === null ? '' : L[dd], dMon: dd === null ? '' : M[dd],
      dTitle: dd === null ? '' : (dd === 13 ? 'Today' : WD[dd]) + ', ' + (dd === null ? '' : L[dd] + ' ' + M[dd]),
      dCount: dd === null ? '' : H[dd] + (H[dd] === 1 ? ' event' : ' events'),
      closeDrill: () => this.setState({ dd: null }), dLinkLead: 'These events live in the Audit log', dLinkText: 'Show in the Audit log ↓', dLinkGo: '', dLinkClick: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ dd: null }); setTimeout(() => window.scrollTo({ top: 280, behavior: 'smooth' }), 60); } };
  }
```

### 3.8 Settings

Desktop: 12-column grid (5 left: hero, Profile, Security / 7 right: Notifications, Appearance). ≤959: one column. Phone: matrix drops the icon column.

#### Settings page-specific CSS — `s/team/settings_redesign.dc.html:56-80`

```css
.tb-g12{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}
.tb-s5{grid-column:span 5;display:flex;flex-direction:column;gap:16px;min-width:0}.tb-s7{grid-column:span 7;display:flex;flex-direction:column;gap:16px;min-width:0}
@media (max-width:959px){.tb-s5,.tb-s7{grid-column:1 / -1}}
.tb-ch2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:12px;padding:12px 18px 6px}
.tb-app{padding:12px 18px 16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px}
.kv>*{min-width:0}
.tb-ch2 .mono.cap{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kv .rt{overflow-wrap:anywhere}
@media (max-width:767px){
  .ph>.tb-segx{flex:1 1 100%}
  .tb-seta{height:40px!important}
  button[aria-label="Change photo"]::before{content:"";position:absolute;inset:-6px}
  html .kv{grid-template-columns:92px minmax(0,1fr) auto}
  html .mx{grid-template-columns:minmax(0,1fr) 60px 76px;gap:10px;padding:10px 12px}
  html .mx>:first-child{display:none}
  .tb-ch2{padding:12px 12px 6px}
  .tb-app{grid-template-columns:minmax(0,1fr);padding:12px}
  #profile>div:last-child,#security>div:last-child{padding-left:14px!important;padding-right:14px!important}
}

.kv{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--hair)}
.kv:first-child{border-top:0}
.kv>.k{font-size:12px;font-weight:700;color:var(--muted)}
.mx{display:grid;grid-template-columns:34px minmax(0,1fr) 84px 84px;gap:12px;align-items:center;padding:10px 16px;border-top:1px solid var(--hair)}
.sw{width:40px;height:40px;border-radius:8px;border:0;cursor:pointer;padding:0}
</style>
```

#### Settings markup (hero, profile, security + password form, notification matrix, appearance, toast, WhatsApp dialog) — `s/team/settings_redesign.dc.html:82-183`

```html
<div class="tb-root">
  <div class="tb-side" data-vp="side"><dc-import name="side" active="8" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="tb-main">
    <dc-import name="topbar" crumb="Settings" hint-size="100%,52px" style="display:block;width:100%"></dc-import>
    <main class="pg tb-wrap">

      <div class="tb-g12">
        <div class="tb-s5">
          <section style="position:relative;border-radius:10px;padding:18px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)) 0%,var(--navy-2-deep,var(--navy-2)) 60%,var(--navy-3-deep,var(--navy-3)) 100%);color:#fff;overflow:hidden;display:flex;align-items:center;gap:16px">
            <div style="position:relative;flex:none"><span style="width:72px;height:72px;border-radius:99px;background:var(--primary-fill,var(--primary));display:flex;align-items:center;justify-content:center;font:700 22px Space Grotesk;box-shadow:0 0 0 3px oklch(100% 0 0 / .25)">RK</span><button type="button" aria-label="Change photo" style="position:absolute;right:-4px;bottom:-4px;width:28px;height:28px;border-radius:6px;border:0;background:var(--gold);color:var(--navy);display:flex;align-items:center;justify-content:center;cursor:pointer" data-tip="Change photo"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4Z M12 10.5a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4Z"></path></svg></button></div>
            <div style="min-width:0;flex:1"><div class="metric" style="font-size:22px;color:#fff">Rahul Khanna</div><div class="mono" style="font-size:11px;opacity:.75;margin-top:2px;overflow-wrap:anywhere">rahul@northwind.in</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><span class="chip" style="background:var(--gold);color:var(--navy)">Primary</span><span class="chip" style="background:oklch(100% 0 0 / .14);color:#fff">Northwind Technologies</span></div></div>
            <span style="position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)"></span>
          </section>

          <section id="profile" class="card">
            <div class="ch" style="padding-bottom:4px"><span class="ic" style="background:var(--navy)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8Z M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"></path></svg></span><h2 class="h3">Profile</h2><button type="button" class="btn btn-g btn-sm" style="margin-left:auto">Edit</button></div>
            <div style="padding:4px 18px 12px">
              <div class="kv"><span class="k">Full name</span><span class="rt">Rahul Khanna</span><span></span></div>
              <div class="kv"><span class="k">Email</span><span class="rt mono" style="font-size:12px">rahul@northwind.in</span><span class="info"><button type="button" aria-label="About changing email"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip" style="left:auto;right:-8px;transform:none">Changing email needs your password. Sign-in moves to the new address.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div>
              <div class="kv"><span class="k">Phone</span><span class="rt mono" style="font-size:12px">+91 98765 43210</span><span></span></div>
              <div class="kv"><span class="k">WhatsApp</span><span class="rt mono" style="font-size:12px">{{waNum}}</span><span class="chip" style="{{waChip}}">{{waState}}</span></div>
            </div>
          </section>

          <section id="security" class="card">
            <div class="ch" style="padding-bottom:4px"><span class="ic" style="background:var(--navy)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10.5h12v9.5H6Z M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"></path></svg></span><h2 class="h3">Security</h2></div>
            <div style="padding:4px 18px 14px">
              <div class="kv"><span class="k">Password</span><span><span class="mono rt">••••••••</span><span class="cap" style="margin-left:8px;display:inline-block;white-space:nowrap">changed 2 Sep</span></span><sc-if value="{{pwClosed}}" hint-placeholder-val="{{true}}"><button type="button" class="btn btn-o btn-sm" onClick="{{openPw}}">Change</button></sc-if></div>
              <sc-if value="{{pwOpen}}" hint-placeholder-val="{{false}}">
                <form style="display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:8px;background:var(--raised);margin:4px 0 8px">
                  <label class="fl">Current password<input class="inp" type="password" value="oldpassword" autocomplete="current-password"></label>
                  <label class="fl">New password<input class="inp" type="password" value="Northwind#2026" autocomplete="new-password"></label>
                  <div style="display:flex;gap:4px" aria-label="Strength: strong"><span style="flex:1;height:5px;border-radius:2px;background:var(--ok)"></span><span style="flex:1;height:5px;border-radius:2px;background:var(--ok)"></span><span style="flex:1;height:5px;border-radius:2px;background:var(--ok)"></span><span style="flex:1;height:5px;border-radius:2px;background:var(--ok)"></span></div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">✓ 8+ characters</span><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">✓ Number</span><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">✓ Symbol</span><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Strong</span></div>
                  <label class="fl">Confirm new password<input class="inp" type="password" value="Northwind#2026" autocomplete="new-password" style="border-color:var(--ok)"></label>
                  <div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn btn-g btn-sm" onClick="{{closePw}}">Cancel</button><button type="button" class="btn btn-n btn-sm" onClick="{{savePw}}">Save password</button></div>
                </form>
              </sc-if>
              <div class="kv"><span class="k">This device</span><span class="rt">Chrome on Windows · Hyderabad</span><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">Active now</span></div>
            </div>
          </section>
        </div>

        <div class="tb-s7">
          <section id="notifications" class="card t">
            <div class="ch"><span class="ic" style="background:var(--navy)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"></path></svg></span><h2 class="h3">Notifications</h2>
              <span class="info"><button type="button" aria-label="About notifications"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Email is Northwind’s record and stays on for anything that needs action. WhatsApp is a quick nudge on top.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span>
            </div>
            <div class="tb-ch2">
              <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;border:1px solid var(--border)">
                <span class="circ" style="background:var(--prog-chip)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5"></path></svg></span>
                <div style="flex:1;min-width:0"><div class="rt" style="font-weight:800">Email</div><div class="mono cap">rahul@northwind.in</div></div>
                <span class="chip" style="background:var(--prog-light);color:var(--prog-text)">Always on</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;border:1px solid var(--border);{{waCard}}">
                <span class="circ" style="background:var(--ok)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z M9.2 8.8c.2-.4.6-.4.9-.2l.8 1.4c.1.3 0 .6-.2.8l-.4.4c.4.9 1.2 1.7 2.1 2.1l.4-.4c.2-.2.5-.3.8-.2l1.4.8c.3.2.3.6.1.9-.5.8-1.4 1.1-2.3.7a7 7 0 0 1-3.7-3.7c-.4-.9-.1-1.8.1-2.6Z"></path></svg></span>
                <div style="flex:1;min-width:0"><div class="rt" style="font-weight:800">WhatsApp</div><div class="mono cap">{{waNum}}</div></div>
                <sc-if value="{{waOn}}" hint-placeholder-val="{{true}}"><span data-tip="WhatsApp is on · click to turn off" style="display:inline-flex"><button type="button" class="tgl on" aria-pressed="true" aria-label="WhatsApp is on · click to turn off" onClick="{{waToggle}}"></button></span></sc-if>
                <sc-if value="{{waOffState}}" hint-placeholder-val="{{false}}"><button type="button" class="btn btn-n btn-sm" onClick="{{waToggle}}">Turn on</button></sc-if>
              </div>
            </div>
            <div class="mx" style="border-top:0;padding-top:12px;padding-bottom:6px"><span></span><span class="lbl">Tell me when</span><span class="lbl" style="text-align:center">Email</span><span class="lbl" style="text-align:center">WhatsApp</span></div>
            <sc-for list="{{prefs}}" as="p" hint-placeholder-count="7">
              <div class="mx">
                <span class="ic" style="{{p.bg}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{p.icon}}"></path></svg></span>
                <span class="rt">{{p.t}}</span>
                <span style="display:flex;justify-content:center"><sc-if value="{{p.locked}}" hint-placeholder-val="{{false}}"><span class="chip" data-tip="Always on · email is Northwind’s record" style="background:var(--raised);color:var(--muted);box-shadow:inset 0 0 0 1px var(--border)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 10.5h12v9.5H6Z M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"></path></svg>On</span></sc-if><sc-if value="{{p.free}}" hint-placeholder-val="{{true}}"><span data-tip="{{p.etip}}" style="display:inline-flex"><button type="button" class="{{p.ec}}" aria-pressed="{{p.ea}}" aria-label="{{p.etip}}" onClick="{{p.te}}"></button></span></sc-if></span>
                <span style="display:flex;justify-content:center"><sc-if value="{{p.hasWa}}" hint-placeholder-val="{{true}}"><span data-tip="{{p.wtip}}" style="display:inline-flex"><button type="button" class="{{p.wc}}" aria-pressed="{{p.wa}}" aria-label="{{p.wtip}}" onClick="{{p.tw}}" disabled="{{p.wdis}}"></button></span></sc-if><sc-if value="{{p.noWa}}" hint-placeholder-val="{{false}}"><span class="cap">—</span></sc-if></span>
              </div>
            </sc-for>
            <div class="mx" style="background:var(--raised);border-radius:0 0 10px 10px"><span class="ic" style="background:var(--navy-2)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"></path></svg></span><span class="rt">Quiet hours · no WhatsApp 9 pm – 8 am</span><span></span><span style="display:flex;justify-content:center"><span data-tip="{{qtip}}" style="display:inline-flex"><button type="button" class="{{qc}}" aria-pressed="{{qa}}" aria-label="{{qtip}}" onClick="{{tq}}" disabled="{{wdis}}"></button></span></span></div>
          </section>

          <section id="appearance" class="card">
            <div class="ch"><span class="ic" style="background:var(--navy)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.6-1-2.6 0-.9.7-1.4 1.6-1.4H16a4.5 4.5 0 0 0 4.5-4.5c0-4-3.8-7-8.5-7Z M7.5 12h.01 M10 8h.01 M14.5 8h.01"></path></svg></span><h2 class="h3">Appearance</h2></div>
            <div class="tb-app">
              <div><div class="lbl" style="margin-bottom:8px">Theme</div><div class="seg" role="tablist" style="grid-template-columns:repeat(3,minmax(0,1fr))"><span class="thumb" style="width:calc((100% - 4px)/3);{{ththumb}}"></span><sc-for list="{{themes}}" as="t" hint-placeholder-count="3"><button type="button" role="tab" class="{{t.cls}}" onClick="{{t.pick}}">{{t.label}}</button></sc-for></div></div>
              <div><div class="lbl" style="margin-bottom:8px">Reduce motion</div><span data-tip="{{mtip}}" style="display:inline-flex"><button type="button" class="{{mc}}" aria-pressed="{{ma}}" aria-label="{{mtip}}" onClick="{{tm}}"></button></span></div>
              
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
  <sc-if value="{{toast}}" hint-placeholder-val="{{false}}"><div class="toast tb-toast"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:oklch(80% 0.12 160)"><path d="M5 12.5 10 17.5 19 7"></path></svg><span>{{toastText}}</span><a href="#" onClick="{{undo}}">Undo</a></div></sc-if>
  <sc-if value="{{waDialog}}" hint-placeholder-val="{{false}}">
    <div class="ov tb-ov">
      <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="wa-t" style="width:460px">
        <div class="dlg-h"><span class="ic" style="background:var(--ok)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z"></path></svg></span><h2 id="wa-t" style="margin:0;font:700 16px Manrope;color:var(--navy-ink,var(--navy))">Turn on WhatsApp</h2><button type="button" class="ibtn" aria-label="Close" style="margin-left:auto;border:0" onClick="{{closeWa}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button></div>
        <div class="dlg-b">
          <div style="display:flex;align-items:center;gap:8px"><span class="node" style="background:var(--ok-chip);width:24px;height:24px;box-shadow:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"></path></svg></span><span style="font-size:12px;font-weight:700">Number</span><span style="flex:1;height:2px;background:var(--ok)"></span><span class="node pulse" style="background:var(--navy);width:24px;height:24px;box-shadow:none;font:700 11px Manrope">2</span><span style="font-size:12px;font-weight:700">Code</span><span style="flex:1;height:2px;border-top:2px dashed var(--border)"></span><span class="node" style="background:var(--panel);color:var(--muted);width:24px;height:24px;box-shadow:inset 0 0 0 1.5px var(--border);font:700 11px Manrope">3</span><span style="font-size:12px;font-weight:700;color:var(--muted)">Done</span></div>
          <label class="fl">WhatsApp number<span style="display:flex;gap:8px"><span class="inp mono" style="width:70px;display:flex;align-items:center">+91</span><input class="inp mono" value="98765 43210" style="flex:1"></span></label>
          <div class="fl">Code sent to WhatsApp<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px"><input class="inp mono" aria-label="Digit 1" value="4" style="text-align:center;font-size:18px;height:44px"><input class="inp mono" aria-label="Digit 2" value="7" style="text-align:center;font-size:18px;height:44px"><input class="inp mono" aria-label="Digit 3" value="2" style="text-align:center;font-size:18px;height:44px"><input class="inp mono" aria-label="Digit 4" value="" style="text-align:center;font-size:18px;height:44px;border-color:var(--navy)"><input class="inp mono" aria-label="Digit 5" value="" style="text-align:center;font-size:18px;height:44px"><input class="inp mono" aria-label="Digit 6" value="" style="text-align:center;font-size:18px;height:44px"></div></div>
          <label style="display:flex;align-items:flex-start;gap:10px;font-size:12.5px;font-weight:600;line-height:1.4"><input type="checkbox" checked style="width:16px;height:16px;margin-top:1px;accent-color:var(--navy)">Send me WhatsApp updates about Northwind. Reply STOP to stop.</label>
        </div>
        <div class="dlg-f"><button type="button" class="btn btn-g" onClick="{{closeWa}}">Cancel</button><button type="button" class="btn btn-n" onClick="{{confirmWa}}">Verify &amp; turn on</button></div>
      </div>
    </div>
  </sc-if>
  <div class="tb-launch"><dc-import name="launcher" hint-size="160px,130px"></dc-import></div>
</div>
```

#### Settings logic (defaults, matrix rows, toggles, toasts) — `s/team/settings_redesign.dc.html:185-237`

```js
<script type="text/x-dc" data-dc-script data-props='{"section":{"editor":"enum","options":[0,1,2,3],"default":2},"pwOpen":{"editor":"boolean","default":false},"waOff":{"editor":"boolean","default":false},"waDialog":{"editor":"boolean","default":false},"toast":{"editor":"text","default":""},"$preview":{"width":1440,"height":1300}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {}; }
  pick(k, d) { const s = this.state; return s[k] !== undefined ? s[k] : d; }
  renderVals() {
    const P = this.props;
    const sec = this.pick('sec', Number(P.section ?? 2));
    const pwOpen = this.pick('pwOpen', Boolean(P.pwOpen));
    const waOff = this.pick('waOff', Boolean(P.waOff));
    const waDialog = this.pick('waDialog', Boolean(P.waDialog));
    const toastText = this.pick('toastText', P.toast || '');
    const em = this.pick('em', { ann: true, feed: false, digest: true });
    const wa = this.pick('wa', { docs: true, steps: true, dead: true, time: true, ann: false, feed: false });
    const q = this.pick('q', true), rm = this.pick('rm', false), th = this.pick('th', (function(){try{var v=JSON.parse(localStorage.getItem('vcfo.theme'));return v==='dark'?1:v==='system'?2:0;}catch(e){return 0;}})()), sw = this.pick('sw', 0);
    const T = ['Profile', 'Security', 'Notifications', 'Appearance'];
    const tabs = T.map((l, i) => ({ label: l, href: '#' + l.toLowerCase(), cls: sec === i ? 'on' : '', c: sec === i ? 'color:#fff' : 'color:oklch(55% 0.022 255)', pick: () => this.setState({ sec: i }) }));
    const tg = (on) => 'tgl' + (on ? ' on' : '');
    const R = [
      ['docs', 'Documents requested or sent back', 1, 'background:var(--due-chip)', 'M7 3.5h7l4 4v13H7Z M14 3.5v4h4 M10 13h5 M10 16.5h5'],
      ['steps', 'Step accepted or needs changes', 1, 'background:var(--ok-chip)', 'M5 12.5 10 17.5 19 7'],
      ['dead', 'Deadlines and reminders', 1, 'background:var(--over-chip)', 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M12 8v4.2l2.8 1.8'],
      ['time', 'Timeline changes', 1, 'background:var(--prog-chip)', 'M4 7h10 M4 12h16 M4 17h7'],
      ['ann', 'Announcements from SBC', 0, 'background:var(--navy-3)', 'M4 10h3l8-4.5v13L7 14H4Z'],
      ['feed', 'Official feed news (MCA, GST, Tax)', 0, 'background:var(--sky-chip)', 'M5 19a1 1 0 1 0 0 .01 M5 12a7 7 0 0 1 7 7 M5 5a14 14 0 0 1 14 14'],
      ['digest', 'Weekly summary · Monday 9 am', 0, 'background:var(--violet-chip)', 'M6 5.5h12v14H6Z M9 9.5h6 M9 13h6 M9 16.5h3']
    ];
    const prefs = R.map((r) => {
      const k = r[0], locked = Boolean(r[2]), hasWa = k !== 'digest';
      const eOn = locked || Boolean(em[k]); const wOn = !waOff && Boolean(wa[k]);
      return { t: r[1], bg: r[3], icon: r[4], locked, free: !locked, hasWa, noWa: !hasWa,
        ec: tg(eOn), ea: eOn ? 'true' : 'false', wc: tg(wOn), wa: wOn ? 'true' : 'false', wdis: waOff,
        etip: 'Email ' + (eOn ? 'on' : 'off') + ' · ' + r[1], wtip: waOff ? 'Turn on WhatsApp first' : 'WhatsApp ' + (wOn ? 'on' : 'off') + ' · ' + r[1],
        te: () => this.setState({ em: { ...em, [k]: !em[k] } }),
        tw: () => this.setState({ wa: { ...wa, [k]: !wa[k] } }) };
    });
    const themes = ['Light', 'Dark', 'System'].map((l, i) => ({ label: l, cls: th === i ? 'on' : '', pick: () => { this.setState({ th: i }); if (window.vcfoSetTheme) window.vcfoSetTheme(['light', 'dark', 'system'][i]); } }));
    const SW = [['Navy', 'background:linear-gradient(115deg,#0f2a4a,#17396b 60%,#1b4f94)'], ['Navy and gold', 'background:linear-gradient(115deg,#0f2a4a,#c9a24b)'], ['Teal', 'background:linear-gradient(115deg,#134e4a,#1b4f94)'], ['Plum', 'background:linear-gradient(115deg,#0f2a4a,#6b3fa0)'], ['Graphite', 'background:#2b3340'], ['Forest', 'background:#1f4d3a']];
    const swatches = SW.map((w, i) => ({ n: w[0], on: sw === i ? 'true' : 'false', s: w[1] + (sw === i ? ';box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--gold)' : ''), pick: () => this.setState({ sw: i }) }));
    return {
      tabs, thumb: 'transform:translateX(' + (sec * 100) + '%)', prefs, themes, ththumb: 'transform:translateX(' + (th * 100) + '%)', swatches,
      pwOpen, pwClosed: !pwOpen, openPw: () => this.setState({ pwOpen: true, sec: 1 }), closePw: () => this.setState({ pwOpen: false }),
      savePw: () => this.setState({ pwOpen: false, toastText: 'Password changed' }),
      waOn: !waOff, waOffState: waOff, waNum: waOff ? 'Not set up' : '+91 98765 43210',
      waState: waOff ? 'Off' : 'Verified', waChip: waOff ? 'background:var(--raised);color:var(--muted)' : 'background:var(--ok-light);color:var(--ok-text)',
      waCard: waOff ? 'background:var(--raised)' : '',
      waToggle: () => waOff ? this.setState({ waDialog: true }) : this.setState({ waOff: true, toastText: 'WhatsApp turned off' }),
      waDialog, closeWa: () => this.setState({ waDialog: false }), confirmWa: () => this.setState({ waDialog: false, waOff: false, toastText: 'WhatsApp is on' }),
      qc: tg(q && !waOff), qa: q ? 'true' : 'false', tq: () => this.setState({ q: !q }), wdis: waOff,
      qtip: waOff ? 'Turn on WhatsApp first' : 'Quiet hours ' + (q ? 'on' : 'off'), mtip: 'Reduce motion ' + (rm ? 'on' : 'off'),
      mc: tg(rm), ma: rm ? 'true' : 'false', tm: () => this.setState({ rm: !rm }),
      toast: Boolean(toastText), toastText, undo: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ toastText: '' }); }
    };
  }
```

### 3.9 Global prototype layer (proto.js) — dark theme, toast, tooltip, fallback messages

#### Dark theme tokens (True black) and dark overrides — `proto.js:36-75`

```js
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
```

#### Global CSS: toast, JS tooltip, page enter/leave, pop-ups on top, no scrollbars — `proto.js:121-153`

```js
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
```

#### Toast function (3200 ms, Undo) — `proto.js:157-167`

```js
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

#### Navigation targets + fallback messages — `proto.js:222-256`

```js
  var SIDE = [['Home', 'home'], ['Updates', 'notifications'], ['Incorporation', 'incorporation'], ['Compliances', 'compliances'], ['Calendar', 'compliances'], ['Filings', 'filings'], ['Documents', 'documents'], ['Library', 'knowledge-bank'], ['Knowledge Bank', 'knowledge-bank'], ['Team', 'team'], ['Audit', 'audit']];
  function label(el) { return ((el.getAttribute('aria-label') || el.getAttribute('data-tip') || el.textContent || el.title || '') + '').replace(/\s+/g, ' ').trim(); }
  function navTarget(el) {
    var t = label(el);
    var inSide = el.closest('aside, .snav, nav[aria-label="Main"]');
    if (inSide) {
      for (var i = 0; i < SIDE.length; i++) if (t.indexOf(SIDE[i][0]) === 0) return SIDE[i][1];
      if (/· Client|Account|Settings/.test(t)) return 'settings';
    }
    if (/^Announcements/.test(t)) return 'announcements';
    if (/^Notifications/.test(t)) return 'notifications';
    if (/^Open Ask VCFO|^Ask VCFO( about this| why)?$|^Ask VCFO about/.test(t)) return 'chat';
    if (/^Settings$/.test(t)) return 'settings';
    return null;
  }
  var KIND = [
    [/download/i, function (t) { return ['Download started · ' + t.replace(/^download\s*/i, ''), false]; }],
    [/zip/i, function () { return ['Preparing the ZIP…', false]; }],
    [/upload|choose file|take photo/i, function () { return ['Choose a file to upload', false]; }],
    [/copy/i, function () { return ['Link copied', false]; }],
    [/whatsapp|call |^call|email|teams/i, function (t) { return ['Opening ' + t + '…', false]; }],
    [/portal|↗/i, function (t) { return ['Opens the official portal in a new tab', false]; }],
    [/approve|submit|send|save|mark|confirm|request|remind|resend|cancel invite|hand off|turn on|turn off/i, function (t) { return [t + ' · done', true]; }],
    [/search/i, function () { return ['Search · type to find steps, filings and documents', false]; }]
  ];
  function chatQuestion(el) {
    if (!/about this/i.test(label(el))) return '';
    var box = el.closest('section,.card,[role="dialog"],.pop,article,li');
    var h = box && box.querySelector('h1,h2,h3,h4,strong,b');
    var t = h ? (h.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return t ? 'Tell me about ' + t : 'Tell me more about this';
  }
  function fallbackMsg(el) {
    var t = label(el) || 'This control';
    for (var i = 0; i < KIND.length; i++) if (KIND[i][0].test(t)) return KIND[i][1](t);
```

#### Icon tooltip (120 ms) and obvious-label suppression — `proto.js:295-312`

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

#### Obvious-label list and tidyTips — `proto.js:660-672`

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
```

### 3.10 Shell sidebar model and Before/After pill (shell.js)

#### Responsive contract notes — `shell.js:1-15`

```js
/* VCFO Suite prototype · one shared sidebar for every screen.
   Draws the navy sidebar (logo, Updates + Compliances groups, Library, team, account) over each board's
   own sidebar placeholder, and the same nav as a drawer. Loaded by proto.js.

   RESPONSIVE CONTRACT (v7) · what boards can rely on
   - <html data-vp-bp="phone|tablet|desktop">   phone <= 767 px · tablet 768-1279 px · desktop >= 1280 px
   - --vp-side-w on <html>: 0px | 72px | 248px  (the board's sidebar placeholder is `width: var(--vp-side-w, 248px); flex: none`)
   - mark the placeholder data-vp="side" (recommended; shell.js also finds a navy column of that width at the left edge)
   - desktop: full 248 px sidebar · tablet: 72 px icon rail (tooltips, fly-outs) · phone: no rail, a drawer
   - window.vcfoOpenSide() opens the drawer (any size) · window.vcfoCloseSide() closes it
   - a board's phone menu button carries data-vp-menu (any click on it opens the drawer)
   - no visible [data-vp-menu] on a phone: shell.js adds a 56 px top band with a 40 px menu button, sets
     <html data-vp-menu-fallback> and --vp-menu-offset: 56px, and pads <body> (and sticky [data-vp="top"]) by it
   - window 'vcfo:bp' event (detail {bp, sideW}) fires when the breakpoint changes
   - Before | After: desktop top bar (before Announcements) · tablet: inside the rail · phone: top of the drawer */
```

#### Navigation model + team contacts — `shell.js:89-110`

```js

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
```

#### Before/After pill CSS — `shell.js:214-226`

```js
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
```

#### Account row and menu — `shell.js:275-306`

```js
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

```

### 3.11 Board sidebar placeholder and launcher (reference only; replaced at runtime)

#### Board sidebar — `s/team/side.dc.html:15-99`

```html
<div style="width:248px;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<aside style="width:248px;min-height:900px;display:flex;flex-direction:column;background:#0f2a4a;color:#fff">
  <a href="#" style="height:52px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid oklch(100% 0 0 / 0.08);color:#fff;flex:none">
    <img src="vcfo-bin:b/026f23bfecd9ea31409d39ee3477d75a.png" alt="" style="width:24px;height:28px;object-fit:contain;filter:brightness(0) invert(1)">
    <span style="font-size:13px;font-weight:700">VCFO Suite</span>
  </a>
  <nav aria-label="Main" class="snav" style="position:relative;display:flex;flex-direction:column;gap:2px;padding:12px 8px">
    <sc-if value="{{showPill}}" hint-placeholder-val="{{true}}">
      <span class="spill" aria-hidden="true" style="position:absolute;left:8px;right:8px;top:12px;height:36px;border-radius:8px;background:oklch(100% 0 0 / .1);box-shadow:inset 0 0 0 1px oklch(66% 0.16 262 / .45),inset 0 1px 0 oklch(100% 0 0 / .12);{{pill}}"></span>
      <span class="srail" aria-hidden="true" style="position:absolute;left:8px;top:20px;height:20px;width:3px;border-radius:99px;background:oklch(66% 0.16 262);z-index:3;{{pill}}"></span>
    </sc-if>
    <a href="#" onClick="{{p0}}" aria-current="{{c0}}" style="display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;{{s0}}"><span style="display:flex;{{i0}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M4.5 4.5h6v7h-6Z M13.5 12.5h6v7h-6Z"></path><path d="M4.5 4.5h6v7h-6Z M13.5 4.5h6v4h-6Z M13.5 12.5h6v7h-6Z M4.5 15.5h6v4h-6Z"></path></svg></span><span style="flex:1">Home</span></a>
    <a href="#" onClick="{{p1}}" aria-current="{{c1}}" style="display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;{{s1}}"><span style="display:flex;{{i1}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M4 10h3l8-4.5v13L7 14H4Z"></path><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"></path></svg></span><span style="flex:1">Updates</span><sc-if value="{{hasUpdates}}" hint-placeholder-val="{{true}}"><span class="chip" style="padding:0 6px;background:var(--over-chip);color:#fff">{{updates}}</span></sc-if></a>
    <a href="#" onClick="{{p2}}" aria-current="{{c2}}" style="display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;{{s2}}"><span style="display:flex;{{i2}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M6 4.5h8v16H6Z"></path><path d="M3.5 20.5h17 M5.5 20.5V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15.5 M14.5 9.5h3a1 1 0 0 1 1 1v10 M8.5 7.8h3 M8.5 11.3h3 M8.5 14.8h3"></path></svg></span><span style="flex:1">Incorporation</span><span class="chip" style="padding:0 6px;background:oklch(100% 0 0 / 0.1);color:#fff">7/14</span></a>
    <a href="#" onClick="{{p3}}" aria-current="{{c3}}" style="display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;{{s3}}"><span style="display:flex;{{i3}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M4.5 7A1.5 1.5 0 0 1 6 5.5h12A1.5 1.5 0 0 1 19.5 7v3h-15Z"></path><path d="M6 5.5h12A1.5 1.5 0 0 1 19.5 7v11.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 6 5.5Z M4.5 10h15 M8.5 3.5v4 M15.5 3.5v4 M8 13.5h2 M8 16.5h2 M12.5 13.5h3.5"></path></svg></span><span style="flex:1">Compliances</span></a>
    <a href="#" onClick="{{p4}}" aria-current="{{c4}}" style="display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;{{s4}}"><span style="display:flex;{{i4}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M3.5 8h17v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"></path><path d="M3.5 18V6A1.5 1.5 0 0 1 5 4.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"></path></svg></span><span style="flex:1">Documents</span><span class="chip" style="padding:0 6px;background:oklch(100% 0 0 / 0.1);color:#fff">6</span></a>
    <a href="#" onClick="{{p5}}" aria-current="{{c5}}" style="display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;{{s5}}"><span style="display:flex;{{i5}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M5.5 5A1.5 1.5 0 0 1 7 3.5h11.5v14H7A1.5 1.5 0 0 0 5.5 19Z"></path><path d="M5.5 19V5A1.5 1.5 0 0 1 7 3.5h11.5v14H7A1.5 1.5 0 0 0 5.5 19a1.5 1.5 0 0 0 1.5 1.5h11.5 M9 7.5h6"></path></svg></span><span style="flex:1">Library</span></a>
    <a href="#" onClick="{{p6}}" aria-current="{{c6}}" style="display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;{{s6}}"><span style="display:flex;{{i6}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z"></path><path d="M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M15.5 5.7a3.3 3.3 0 0 1 0 6.4 M17.5 15.3c1.9.6 3.1 2.1 3.5 4.7"></path></svg></span><span style="flex:1">Team</span></a>
    <a href="#" onClick="{{p7}}" aria-current="{{c7}}" style="display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;{{s7}}"><span style="display:flex;{{i7}}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z"></path><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9 M4.5 4.5V9H9 M12 8v4.2l2.8 1.8"></path></svg></span><span style="flex:1">Audit</span></a>
  </nav>

  <div style="margin-top:auto;padding:0 14px 12px;display:flex;flex-direction:column;gap:12px">
    <div style="border-top:1px solid oklch(100% 0 0 / 0.1);padding-top:12px">
      <div class="lbl" style="color:var(--gold);margin-bottom:10px">Northwind’s team</div>
      <div style="display:flex;align-items:center;gap:10px">
        <div title="Photo placeholder" style="width:40px;height:40px;border-radius:99px;flex:none;background:oklch(62% 0.08 40);box-shadow:0 0 0 2px oklch(100% 0 0 / 0.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px">PR</div>
        <div style="min-width:0"><div style="font-weight:700;font-size:13px">Priya Raman</div><div style="font-size:11px;color:oklch(78% 0.02 255)">Project Manager</div></div>
      </div>
      <div style="display:flex;gap:6px;margin:8px 0 10px 50px">
        <a href="#" aria-label="WhatsApp Priya Raman" style="width:32px;height:30px;border-radius:6px;background:var(--ok);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="WhatsApp Priya Raman"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z"></path></svg></a>
        <a href="#" aria-label="Call Priya Raman" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Call Priya Raman"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h2.2l1.3 3.6-1.8 1.2a10 10 0 0 0 6.5 6.5l1.2-1.8L20 14.8V17a2 2 0 0 1-2 2A14 14 0 0 1 5 6a2 2 0 0 1 2-2Z"></path></svg></a>
        <a href="#" aria-label="Email Priya Raman" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Email Priya Raman"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5"></path></svg></a>
        <a href="#" aria-label="Teams Priya Raman" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Teams Priya Raman"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7h10v10h-10Z M6.5 10h4 M8.5 10v5 M16.5 9.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4Z M15.5 11h5v4.5a2.5 2.5 0 0 1-5 0"></path></svg></a>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div title="Photo placeholder" style="width:40px;height:40px;border-radius:99px;flex:none;background:oklch(55% 0.09 200);box-shadow:0 0 0 2px oklch(100% 0 0 / 0.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px">AM</div>
        <div style="min-width:0"><div style="font-weight:700;font-size:13px">Arjun Mehta</div><div style="font-size:11px;color:oklch(78% 0.02 255)">Project Lead</div></div>
      </div>
      <div style="display:flex;gap:6px;margin:8px 0 10px 50px">
        <a href="#" aria-label="WhatsApp Arjun Mehta" style="width:32px;height:30px;border-radius:6px;background:var(--ok);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="WhatsApp Arjun Mehta"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z"></path></svg></a>
        <a href="#" aria-label="Call Arjun Mehta" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Call Arjun Mehta"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h2.2l1.3 3.6-1.8 1.2a10 10 0 0 0 6.5 6.5l1.2-1.8L20 14.8V17a2 2 0 0 1-2 2A14 14 0 0 1 5 6a2 2 0 0 1 2-2Z"></path></svg></a>
        <a href="#" aria-label="Email Arjun Mehta" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Email Arjun Mehta"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5"></path></svg></a>
        <a href="#" aria-label="Teams Arjun Mehta" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Teams Arjun Mehta"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7h10v10h-10Z M6.5 10h4 M8.5 10v5 M16.5 9.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4Z M15.5 11h5v4.5a2.5 2.5 0 0 1-5 0"></path></svg></a>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;border-radius:99px;flex:none;background:oklch(100% 0 0 / 0.12);box-shadow:0 0 0 2px oklch(100% 0 0 / 0.25);display:flex;align-items:center;justify-content:center;color:oklch(85% 0.02 255)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13v-1a8 8 0 0 1 16 0v1 M4 13h3v6H5a1 1 0 0 1-1-1Z M20 13h-3v6h2a1 1 0 0 0 1-1Z M17 19c0 1.5-2 2.5-5 2.5"></path></svg></div>
        <div style="min-width:0"><div style="font-weight:700;font-size:13px">Customer support</div><div class="mono" style="font-size:11px;color:oklch(78% 0.02 255)">Farhat · +91 90597 90014</div></div>
      </div>
      <div style="display:flex;gap:6px;margin:8px 0 2px 50px">
        <a href="#" aria-label="WhatsApp support" style="width:32px;height:30px;border-radius:6px;background:var(--ok);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="WhatsApp support"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z"></path></svg></a>
        <a href="#" aria-label="Email support" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Email support"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5"></path></svg></a>
        <a href="#" aria-label="Teams support" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Teams support"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7h10v10h-10Z M6.5 10h4 M8.5 10v5 M16.5 9.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4Z M15.5 11h5v4.5a2.5 2.5 0 0 1-5 0"></path></svg></a>
        <a href="#" aria-label="Call support" style="width:32px;height:30px;border-radius:6px;background:oklch(100% 0 0 / 0.1);color:#fff;display:flex;align-items:center;justify-content:center" data-tip="Call support"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h2.2l1.3 3.6-1.8 1.2a10 10 0 0 0 6.5 6.5l1.2-1.8L20 14.8V17a2 2 0 0 1-2 2A14 14 0 0 1 5 6a2 2 0 0 1 2-2Z"></path></svg></a>
      </div>
    </div>
    <a href="#" onClick="{{p8}}" aria-current="{{c8}}" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;border-top:1px solid oklch(100% 0 0 / 0.1);color:#fff;{{acct}}">
      <span style="width:32px;height:32px;border-radius:99px;flex:none;background:var(--primary-fill,var(--primary));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px">RK</span>
      <span style="flex:1;min-width:0"><span style="display:block;font-weight:700;font-size:13px">Rahul Khanna</span><span style="display:block;font-size:11px;color:oklch(78% 0.02 255)">Northwind · Client</span></span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:oklch(78% 0.02 255)"><path d="M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z M19.4 13.5l1.6 1.2-2 3.5-1.9-.7a7.6 7.6 0 0 1-1.7 1l-.3 2h-4l-.3-2a7.6 7.6 0 0 1-1.7-1l-1.9.7-2-3.5 1.6-1.2a7.7 7.7 0 0 1 0-3l-1.6-1.2 2-3.5 1.9.7a7.6 7.6 0 0 1 1.7-1l.3-2h4l.3 2a7.6 7.6 0 0 1 1.7 1l1.9-.7 2 3.5-1.6 1.2a7.7 7.7 0 0 1 0 3Z"></path></svg>
    </a>
  </div>
</aside>
</div>
</template></x-dc><script>(function(){var x=document.querySelector("x-dc"),t=x&&x.firstElementChild;if(t&&t.tagName==="TEMPLATE"){x.replaceChildren(document.adoptNode(t.content));}})();</script>
<script type="text/x-dc" data-dc-script data-props='{"active":{"editor":"enum","options":[0,1,2,3,4,5,6,7,8],"default":0},"updates":{"editor":"int","default":3},"$preview":{"width":248,"height":900}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {}; }
  renderVals() {
    const s = this.state || {};
    const a = (s.active !== undefined) ? s.active : Number(this.props.active ?? 0);
    const out = {};
    for (let i = 0; i < 9; i++) {
      const on = a === i;
      out['p' + i] = (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ active: i }); };
      out['c' + i] = on ? 'page' : 'false';
      out['s' + i] = on ? 'color:#fff;font-weight:600' : 'color:oklch(82% 0.02 255);font-weight:500';
      out['i' + i] = on ? 'color:oklch(80% 0.1 255)' : 'color:oklch(72% 0.03 255)';
    }
    out.showPill = a < 8;
    out.pill = 'transform:translateY(' + (a * 38) + 'px)';
    out.acct = a === 8 ? 'background:oklch(100% 0 0 / .1);box-shadow:inset 0 0 0 1px oklch(66% 0.16 262 / .45)' : '';
    const u = Number(this.props.updates ?? 3);
    out.updates = u; out.hasUpdates = u > 0;
    return out;
  }
```

#### Board launcher — `s/team/launcher.dc.html:15-20`

```html
<div style="width:160px;height:130px;position:relative;font-family:Manrope,system-ui,sans-serif">
  <div class="botup" style="position:absolute;right:24px;bottom:16px;display:flex;flex-direction:column;align-items:center;gap:6px">
    <span style="background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:6px;padding:4px 10px;position:relative">Ask VCFO<span style="position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)"></span></span>
    <button type="button" aria-label="Open Ask VCFO" style="width:68px;height:68px;border-radius:99px;border:0;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer" data-tip="Open Ask VCFO"><span class="bob" style="display:flex"><dc-import name="v7c_bot" state="idle" size="50" hint-size="50px,50px"></dc-import></span></button>
  </div>
</div>
```

### 3.12 Canvas index (Main.dc.html) — change table, improvement ideas, owner decisions

#### Main canvas content — `s/team/Main.dc.html:30-80`

```html
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">
    <section class="card t">
      <div class="ch"><h2 class="st">What changes, page by page</h2></div>
      <div style="padding:8px 18px 16px">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr><th>Page</th><th>Current</th><th>Redesign</th></tr></thead>
          <tbody>
            <tr><td class="rt">Team</td><td style="white-space:normal">Client list + invite form side by side. No SBC people.</td><td style="white-space:normal">SBC team cards with photo + WhatsApp · Phone · Email · Teams. Your people list. Invite in a pop-up.</td></tr>
            <tr><td class="rt">Notifications</td><td style="white-space:normal">Two pickers (date, direction). Row expands for time.</td><td style="white-space:normal">One navy pill: All · Unread · Documents · Steps · Deadlines. Unread rows tinted with a dot. Mark all read.</td></tr>
            <tr><td class="rt">Announcements</td><td style="white-space:normal">Text list + long portals list.</td><td style="white-space:normal">Kind chips, date tiles, pill All · Important · General. Detail pop-up. Portals as compact chips.</td></tr>
            <tr><td class="rt">Audit</td><td style="white-space:normal">Staff table with Global / By project tabs, role and type selects, raw metadata.</td><td style="white-space:normal">Timeline: date first, then activity. Day groups. Pill filter. Plain-language details.</td></tr>
            <tr><td class="rt">Settings</td><td style="white-space:normal">Profile + Security + Appearance. WhatsApp tick inside Profile. No notification choices.</td><td style="white-space:normal">Pill: Profile · Security · Notifications · Appearance. Password change. Email / WhatsApp per event.</td></tr>
            <tr><td class="rt">Messages</td><td style="white-space:normal">Redirects to Home.</td><td style="white-space:normal">Not designed (client cannot reach it).</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card t">
      <div class="ch"><h2 class="st">Other improvements we propose</h2></div>
      <div style="padding:8px 18px 16px">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr><th>#</th><th>Idea</th><th>Where</th><th>Effort</th></tr></thead>
          <tbody>
            <tr><td class="mono">1</td><td style="white-space:normal">Store announcement “read” on the server, not in the browser</td><td>Announcements</td><td><span class="chip" style="background:var(--due-light);color:var(--due-text)">M</span></td></tr>
            <tr><td class="mono">2</td><td style="white-space:normal">Audit: client sees client-safe events only (hide email/internal metadata)</td><td>Audit</td><td><span class="chip" style="background:var(--due-light);color:var(--due-text)">M</span></td></tr>
            <tr><td class="mono">3</td><td style="white-space:normal">Audit: Download as PDF / CSV for the company file</td><td>Audit</td><td><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">S</span></td></tr>
            <tr><td class="mono">4</td><td style="white-space:normal">Invite: send a set-password link instead of typing a temporary password</td><td>Team</td><td><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Approved</span></td></tr>
            <tr><td class="mono">5</td><td style="white-space:normal">Pending invite state + Resend / Cancel</td><td>Team</td><td><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">S</span></td></tr>
            <tr><td class="mono">6</td><td style="white-space:normal">Notification preferences saved per user (new table)</td><td>Settings</td><td><span class="chip" style="background:var(--due-light);color:var(--due-text)">M</span></td></tr>
            <tr><td class="mono">7</td><td style="white-space:normal">Quiet hours for WhatsApp (no nudges 9 pm – 8 am)</td><td>Settings</td><td><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">S</span></td></tr>
            <tr><td class="mono">8</td><td style="white-space:normal">Sign out of other devices + last sign-in time</td><td>Settings</td><td><span class="chip" style="background:var(--due-light);color:var(--due-text)">M</span></td></tr>
            <tr><td class="mono">9</td><td style="white-space:normal">Notification row deep-links to the exact step or document</td><td>Notifications</td><td><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">S</span></td></tr>
            <tr><td class="mono">10</td><td style="white-space:normal">Merge Announcements + Notifications under one “Updates” page with two pills</td><td>Updates</td><td><span class="chip" style="background:var(--raised);color:var(--muted)">Not now</span></td></tr>
            <tr><td class="mono">11</td><td style="white-space:normal">Messages: ship as a thread with the project lead (reuse Ask VCFO hand-off)</td><td>Messages</td><td><span class="chip" style="background:var(--over-light);color:var(--over-text)">L</span></td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <section class="card">
    <div class="ch"><h2 class="st">Owner decisions · 9 Oct 2026</h2><span class="chip" style="background:var(--ok-light);color:var(--ok-text)">Decided</span></div>
    <div style="padding:10px 18px 16px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px">
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Team</div><div class="rt" style="margin-top:6px">Primary contact only can invite</div></div>
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Team</div><div class="rt" style="margin-top:6px">Invite by set-password link</div><div class="cap" style="margin-top:4px">Temp password until it ships</div></div>
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Settings</div><div class="rt" style="margin-top:6px">Email locked for documents, steps, deadlines, timeline</div><div class="cap" style="margin-top:4px">Optional: news, weekly summary</div></div>
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Audit</div><div class="rt" style="margin-top:6px">SBC staff shown by name and role</div><div class="cap" style="margin-top:4px">No emails, no internal metadata</div></div>
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Updates</div><div class="rt" style="margin-top:6px">Keep 2 pages</div><div class="cap" style="margin-top:4px">No merge for now</div></div>
    </div>
  </section>
```

### 3.13 Measurement cheat sheet (from the excerpts above)

| Thing | Value |
|---|---|
| Content max width / padding | 1600 px centred; `clamp(16px,2vw,24px)` sides+top, 96 px bottom (phone 16/16/104) |
| Vertical gap between page blocks | 16 px (`.pg` gap) |
| Card | radius 10, 1 px `--border`, `--shadow`; `.card.t` gold tab 38×3 at left 18 |
| Card header `.ch` | padding 16 18 0, gap 10 |
| List header `.tb-hd` / `.tb-ph` | padding 12×16 / 14×16, gap 10, bottom hairline (`.tb-hd`) |
| Row `.row` | padding 12×16, gap 12, top hairline (first none) |
| Icon circle `.ic` / `.circ` | 30 px / 44 px, white glyph 15 / 20 px |
| Notification icon tile `.nic` | 32×32 radius 8, glyph 18 px stroke 2 |
| Date tile `.dtile` | 50×54 radius 8 (Audit day 60×62; phone 50×52); day 700 18 px Space Grotesk; month 11 px uppercase |
| Status node `.node` | 28 px circle, 3 px panel ring, glyph 15 px stroke 2.6 |
| Avatars | SBC card 60; people row 36; audit 24; hand-off 34; detail 30; settings hero 72 |
| Chip | radius 4, padding 2×7, 700 11 px, line-height 16 |
| Buttons | `.btn` 36 / `.btn-sm` 30 / `.ibtn` 32×30 (all 40 on phone); radius 6 |
| Pill | track pad 2 radius 8; buttons 28 high (40 phone), pad 0 10, 500 12 px |
| Toggle | 38×22 radius 6, knob 16 radius 4 |
| Dialog widths | Invite 460 · Hand-off 500 · Announcement 560 · Notifications drill 600 · Audit drill 760 · WhatsApp 460; radius 12 |
| Drill list height | `max-height:min(420px,52dvh)` |
| Fonts | Manrope (UI), Space Grotesk (metrics, date tiles, dialog title AD), IBM Plex Mono (counts, times, emails, numbers) |
