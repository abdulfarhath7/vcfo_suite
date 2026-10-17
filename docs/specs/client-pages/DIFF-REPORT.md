# Client portal: differences from the approved prototype

Built portal (role `client`, `app/app/client/**`, branch `claude/multi-agent-chat-design-rhtbl4`) compared with `prototype/vcfo-client-portal-FINAL.html`, screen by screen at 1440 px and 390 px, on demo data. Compiled 2026-10-17. No app code was changed.

Owner marks (Fix / Keep + note) are kept on the interactive report page (https://claude.ai/artifact/3HKLoYQn3hBKShFRdVS3f5, private until shared); this file is the static copy. Screenshot crops are in `diff-shots/` (`<ID>-app.webp`, `<ID>-proto.webp`).

## Summary

| Area | High | Medium | Low | Info | Total |
|---|---:|---:|---:|---:|---:|
| Timelines | 4 | 9 | 9 | 4 | 26 |
| Home | 3 | 7 | 10 | 6 | 26 |
| Incorporation | 6 | 8 | 9 | 7 | 30 |
| Compliances | 3 | 6 | 6 | 12 | 27 |
| Documents & Library | 4 | 6 | 12 | 8 | 30 |
| Team, updates, settings, credentials | 6 | 8 | 9 | 9 | 32 |
| Shell, Ask VCFO, intro | 4 | 5 | 8 | 8 | 25 |
| **All** | **30** | **49** | **63** | **54** | **196** |

## Root causes worth fixing first

- **Prototype stylesheets were merged into one scope, so class names collide.** Each prototype screen had its own CSS. The build concatenated them under `.cp` (scripts/cp-css.mjs), so the same class means different things on different pages. Examples: `.ic` paints every incorporation icon white on white (TL-03), `.card` stacks the compliance donut into a tall column, `.sub` shifts the Days-to-COI line, `.st` turns the approval bar into capitals, and `[data-tip]` draws a second tooltip on the 1024 px rail. Fix: scope each screen's CSS to its own page root (or prefix its class names) and re-check every page.
- **The `hidden` attribute is ignored inside the portal.** The `.cp … {all:revert}` reset in css/00-tokens.css beats the browser's `[hidden]` rule. Raw 'Choose File' inputs therefore show on Home, Settings and the upload dialogs, and hidden submit buttons show as empty bars in Team and Settings dialogs. Fix: add `.cp [hidden]{display:none!important}`.
- **The desktop incorporation gantt falls back to the phone layout.** Phases without planned dates are drawn full width, so their labels never fit and the whole chart switches to the stacked 'simple' mode at every width (TL-01, TL-02).
- **The long company name is used where the prototype uses a short one.** 'Northwind Technologies' (and "…Technologies's") overflows owner chips, activity tabs, This-week chips, donut titles and the sidebar team label. Use a short display name everywhere the prototype says 'Northwind'.
- **Filing period labels repeat the filing name.** Home and Compliances build the period from the register's particular, giving titles like 'Advance Tax Payment Q2 · Advance Tax Payment Q2 2026'. Use one period formatter (`displayPeriod`) everywhere.

## How it was run

- App: `next dev` on local Postgres 16 (migrated + `db:seed` + `db:seed-demo`), S3 served by a local S3 emulator. Extra fake data came from a scratch SQL script (not committed): the client login `client@vcfo.local` was attached to a pre-incorporation project at step 7 with planned dates, open requests, SBC work items, documents, activity and notifications; a second demo client was used for an incorporated project (After COI).
- Prototype: `vcfo-client-portal-FINAL.html#/<route>` in headless Chromium, Before/After set through its own `vcfo.after` setting, intro skipped except when reviewing the intro.
- Every page at 1440 × 900 and 390 × 844 (tablet rail at 1024), plus the pop-ups, drill-downs and editors opened by clicking. Nothing was submitted, uploaded or approved.
- Data differences (dates, names, counts from the demo seed) are not listed unless the shape differs. Rows marked **Info** are not real differences: the app is correct and the prototype shows fake data, or both behave the same.
- The Next.js dev-mode "N" badge at the bottom-left of app screenshots is a development tool, not part of the portal.



## Timelines

### TL-01 · Desktop gantt collapses to the phone layout  (High)
*Incorporation · landing (before COI) — Timeline gantt*  
Prototype at 1440 px: one row per phase with a shared date axis (15 Sep … 22 Dec), bars placed on their dates, a red Today line and the % / steps label beside each bar. App at 1440 px: no date axis, no Today line, every bar stretched to full width under its row, labels pushed below — the phone (stacked) layout.  
**Fix:** src/components/client-portal/pages/incorporation/Landing.tsx layoutGantt(): phases with no planned dates (Post-incorporation, Registration) get width 100%, so their label never fits and the whole card is switched to `.simple`. Give unplanned phases a fixed hatched bar after the COI date as the prototype does (final-src/s/inc/incorporation.html), and only fall back to `.simple` below the prototype's phone breakpoint, never on desktop.  
Screens: [app](diff-shots/TL-01-app.webp) · [prototype](diff-shots/TL-01-proto.webp)

### TL-02 · After-COI gantt also collapses  (High)
*Incorporation · landing (after COI) — Timeline gantt*  
Prototype after COI: Part A and Part B as finished bars on the axis, Post-incorporation and Registration bars at their dates with 'Now · step' markers and the Today line. App: same full-width stacked layout as before COI; no axis, no Today line, Registration shows only an empty hatched band.  
**Fix:** Same fix as the before-COI gantt in Landing.tsx (layoutGantt / phase plans). Post-incorporation plan = COI → latest statutory window; Registration plan = earliest → latest registration window.  
Screens: [app](diff-shots/TL-02-app.webp) · [prototype](diff-shots/TL-02-proto.webp)

### TL-03 · Icons invisible: white on white  (High)
*Incorporation · landing, phase, step pages — Icons (all incorporation screens)*  
Prototype shows the chevron on 'Steps', the arrow on 'Open', the back arrow, the attachment / ? / → icons in step tables and the person / ⋮ / ? icons in the journey rail. In the app all of these render white on a white button, so the buttons look empty.  
**Fix:** CSS collision: css-src/10-base.css `.ic{…color:#fff}` (Home's who-holds circle) also matches the incorporation `<svg class="ic">` (incorporation-pages.css `.ic{width:16px;height:16px}`), and home-m.css has a third `.ic`. Scope each screen's stylesheet to its own page root in scripts/cp-css.mjs (e.g. `.cp .pg-inc .ic`) or rename the classes. Check every other duplicated class name the same way — this merge is a likely root cause of other drift.  
Screens: [app](diff-shots/TL-03-app.webp) · [prototype](diff-shots/TL-03-proto.webp)

### TL-04 · Missed statutory windows not shown as overdue  (High)
*Home · after COI — Post-incorporation setup*  
The prototype bar shows 'day N of limit', coloured by owner. The app caps 'day' at the limit, so steps whose window ended weeks ago (ADT-1, FC-GPR, MGT, INC-22, Name Board, due 3 Sep, day 74 since COI) look like a calm full blue bar 'day 30 of 30' with no overdue cue. The drill-down calls them just 'Open'.  
**Fix:** derive.ts buildPostInc(): when today > dueDate and the step is not done, mark it overdue (tone 'over', bar var(--over), caption 'overdue N days'), and use the same in postIncDrill (chip 'Overdue'). CardsB.tsx PostIncCard + MobileHome post-inc rows.  
Screens: [app](diff-shots/TL-04-app.webp) · [prototype](diff-shots/TL-04-proto.webp)

### TL-05 · Part A says 'days early' instead of late  (Medium)
*Incorporation · landing — Timeline · SPICe+ Part A row*  
Prototype compares Part A's finish with Part A's own planned end and shows '3 days late' plus a red late tail on the bar. App compares it with the whole incorporation window end (the COI date), so a finished Part A always reads '34 days early' and the late tail never appears.  
**Fix:** Landing.tsx phase plans: Part A plan end = the latest step window in Phase 1 (or the name-approval window), not schedule.incorporation.to. Same for PhasePage.tsx 'days early' badge.  
Screens: [app](diff-shots/TL-05-app.webp) · [prototype](diff-shots/TL-05-proto.webp)

### TL-06 · Axis crammed with weekly ticks  (Medium)
*Home · after COI — Timeline card*  
Prototype shows about 9 weekly ticks with the bars filling the card. App keeps a tick every 7 days for the whole span (19 Jun → 23 Oct = 19 labels), so labels crowd together and the four bars are squeezed into the left 40% of the card.  
**Fix:** src/components/client-portal/pages/home/derive.ts timelineAxis(): pick the tick step (7 / 14 / 28 days, or months) so there are at most ~9 ticks; consider ending the axis a little after COI and pinning a 'Today →' chip at the right edge when today is far past COI.  
Screens: [app](diff-shots/TL-06-app.webp) · [prototype](diff-shots/TL-06-proto.webp)

### TL-07 · Editor dialog far wider and top-aligned  (Medium)
*Home / Incorporation · timeline editor — Request a timeline change dialog*  
Prototype: a centred dialog about 756 px wide with the page visible around it. App: about 1180 px wide, pinned to the top and almost full height, covering the whole page.  
**Fix:** TimelineEditor.tsx / css-src/home-tle.css: max-width and vertical centring as in final-src/tl-editor.js (.tle dialog).  
Screens: [app](diff-shots/TL-07-app.webp) · [prototype](diff-shots/TL-07-proto.webp)

### TL-08 · Info banner overflows the screen  (Medium)
*Home · timeline editor (phone 390) — Editor on phone*  
Prototype's phone sheet fits the 390 px width. App's banner is wider than the sheet: its text is cut off at the right edge ('…approves' clipped).  
**Fix:** TimelineEditor.tsx / home-tle.css: banner width 100% with box-sizing border-box (or remove the banner, see the row above).  
Screens: [app](diff-shots/TL-08-app.webp) · [prototype](diff-shots/TL-08-proto.webp)

### TL-09 · Drill-down pinned to the top  (Medium)
*Home · timeline — Timeline phases drill-down*  
Prototype opens the 'Timeline phases' pop-up centred on screen. App opens it pinned to the top edge of the viewport, and the 'Open full list' link in the footer is missing.  
**Fix:** Shared drill-down in src/components/client-portal/shared.tsx (rule-14 pop-up): centre vertically like v7x_drilldown.dc.html and add the footer link.  
Screens: [app](diff-shots/TL-09-app.webp) · [prototype](diff-shots/TL-09-proto.webp)

### TL-10 · Sub-step ticks have no labels  (Medium)
*Incorporation · phase page — Journey rail · Now card*  
Prototype's Now card shows the step's sub-steps by name (Office addr. · State · NOC · Utility bill) with done / current colours. App shows six unlabelled grey dots and '0 of 6 sub-steps done'.  
**Fix:** PhasePage.tsx focus-track Now card: label the ticks from the step's field groups (DECISIONS: 'Focus track plus F's sub-step ticks'), as in final-src/s/inc/phase.html.  
Screens: [app](diff-shots/TL-10-app.webp) · [prototype](diff-shots/TL-10-proto.webp)

### TL-11 · Open rows not sorted by deadline  (Medium)
*Home · after COI — Post-incorporation setup*  
Prototype lists open items by nearest deadline (FC-GPR 2 Dec, MGT 23 Nov…). The app lists them in step-number order (Bank Account Opening first with '—', then items due in Jan before items overdue since Sep).  
**Fix:** derive.ts buildPostInc(): sort `open` by dueDate (undated last) before returning; same list feeds the phone card and drill.  
Screens: [app](diff-shots/TL-11-app.webp) · [prototype](diff-shots/TL-11-proto.webp)

### TL-12 · Track labels overlap in the side panel  (Medium)
*Compliances Filings · side panel — Focus track*  
In the prototype the 4 nodes have room and short labels. In the app's 520 px panel, the navy 'NOW · Data received' hero card plus 3 nodes squeeze the labels. 'SBC preparing' and 'Halcyon Payments approves' run into each other ('SBC preparingHalcyon Payments').  
**Fix:** bits.tsx FocusTrack: give .ft-l a max-width equal to the gap or wrap labels (max-width:100px is per node but nodes sit closer than that). Shorten to '<company short> approves', or use the vertical track under 560 px.  
Screens: [app](diff-shots/TL-12-app.webp) · [prototype](diff-shots/TL-12-proto.webp)

### TL-13 · Timeline view: read-only (prototype drags)  (Medium)
*Compliances Calendar · Timeline view — Toolbar / bars*  
In the prototype, bars can be dragged (move) or edge-dragged (resize) with snapping and a navy read-out, and arrow keys move them. It also has a '↶ Undo' button, an undo toast and the hint 'Drag a filing window to move it · drag its edges to resize · snaps to days…'. The app has no Undo button, no grab handles and no drag. Its hint reads 'Filing windows are set by SBC · drag to pan…', and clicking a bar opens the detail pop-up. This follows the inventory recommendation (clients cannot write windows), so it needs owner sign-off. Needs the owner's decision: build the drag editor for clients, or keep it read-only.  
**Fix:** Owner call. If client edits are wanted: add handles/drag + POST /api/filings/[id]/window permission for clients (TimelineView.tsx). Otherwise keep it and note it in DECISIONS.md.  
Screens: [app](diff-shots/TL-13-app.webp) · [prototype](diff-shots/TL-13-proto.webp)

### TL-14 · Phase bars not continuous; last tick clipped  (Low)
*Home · before COI — Timeline card*  
Prototype: Phase 2 starts right where Phase 1 ends, MCA review follows Phase 2, all ticks fit. App: Phase 2 starts at its first step window (a gap after 'Done 5 Oct'), and the right-most tick label ('18 Nov') is cut off at the card edge. Otherwise the card matches.  
**Fix:** derive.ts buildTimeline(): start Phase 2 at Phase 1's done date when Phase 1 is done; timelineAxis(): don't place a tick within ~3% of the right edge.  
Screens: [app](diff-shots/TL-14-app.webp) · [prototype](diff-shots/TL-14-proto.webp)

### TL-15 · Phase label column wider  (Low)
*Home · before / after COI — Timeline card · labels*  
Prototype uses a 150 px label column, so 'Phase 1 · Name Application' wraps to two lines and the chart gets more width. App's label column is wider and never wraps.  
**Fix:** Home timeline grid in CardsB.tsx / home-base.css: grid-template-columns:150px minmax(0,1fr) as in v7c_timeline_a.dc.html.  
Screens: [app](diff-shots/TL-15-app.webp) · [prototype](diff-shots/TL-15-proto.webp)

### TL-16 · Date tooltip stuck on Phase 2  (Low)
*Home / Incorporation · timeline editor — Editor chart*  
Prototype (client mode, desktop) shows the date bubble only while a bar is dragged. App always shows '7 Oct – 29 Oct · 22 days' over the Phase 2 bar when the dialog opens, covering the 'Today' chip.  
**Fix:** TimelineEditor.tsx: show the drag bubble only during pointer drag / keyboard move, as tl-editor.js does.  
Screens: [app](diff-shots/TL-16-app.webp) · [prototype](diff-shots/TL-16-proto.webp)

### TL-17 · Extra blue info banner  (Low)
*Home / Incorporation · timeline editor — Editor header*  
Prototype states who approves only in the footer line. App adds a blue banner 'The change is a request. … approves or rejects it.' above the toolbar, pushing the chart down.  
**Fix:** TimelineEditor.tsx: drop the banner (the footer already says it) or ask the owner to keep it.  
Screens: [app](diff-shots/TL-17-app.webp) · [prototype](diff-shots/TL-17-proto.webp)

### TL-18 · Right-hand dates in light mono font  (Low)
*Home / Incorporation · timeline editor — Editor · date column*  
Prototype prints each phase's range ('12 Sep – 24 Sep') in bold sans. App uses the light monospace font.  
**Fix:** home-tle.css: copy the prototype's date-column style from tl-editor.js.  
Screens: [app](diff-shots/TL-18-app.webp) · [prototype](diff-shots/TL-18-proto.webp)

### TL-19 · Rail shows numbers + 'Opens later'  (Low)
*Incorporation · phase page — Journey rail · later steps*  
Prototype rail shows status icons, 'In progress · due 16 Oct' and dot progress for steps 8–10. App shows plain numbers and 'Opens later' because the step gate keeps steps 8–9 closed until step 7 is done. Partly data / gate; the missing icons are the white-icon bug.  
**Fix:** PhasePage.tsx: after the .ic CSS fix, re-check; show the due date for gated steps that have a window.  
Screens: [app](diff-shots/TL-19-app.webp) · [prototype](diff-shots/TL-19-proto.webp)

### TL-20 · Owner chips cut off in step table  (Low)
*Incorporation · landing — Timeline · expanded Steps*  
Prototype's expanded phase table fits the owner chip. App truncates long owner names ('Northwind Techn…') and the chip overlaps the status column.  
**Fix:** StepTable.tsx variant 'landing': use the short company name (shell.companyShort) in owner chips, like the prototype.  
Screens: [app](diff-shots/TL-20-app.webp) · [prototype](diff-shots/TL-20-proto.webp)

### TL-21 · Track shows 'Data received · waiting on you' and '—'  (Low)
*Compliances Calendar · detail pop-up — Focus track content*  
The prototype track reads Data received (done, date) → NOW SBC preparing → Northwind approves 'by 18 Oct' → Filed 'due 20 Oct'. With no data dates, the app's current node is 'Data received' with sub 'waiting on you', which reads as done although it is pending. The approve node shows a bare '—' under its label.  
**Fix:** src/lib/client-portal/compliances.ts focusNodes(): name the pending first step 'Send data' or 'Data needed' while waiting, and leave the sub blank instead of '—'.  
Screens: [app](diff-shots/TL-21-app.webp) · [prototype](diff-shots/TL-21-proto.webp)

### TL-22 · Rail stub under single events  (Low)
*Audit — Timeline rail*  
Prototype rail joins events within a day and ends at the last event. In the app each one-event day draws a dangling vertical line below the node.  
**Fix:** AuditPage.tsx .tb-vl: draw the rail only when the day has 2+ events (or end it at the last node) — css/team-audit.css.  
Screens: [app](diff-shots/TL-22-app.webp) · [prototype](diff-shots/TL-22-proto.webp)

### TL-23 · Manager/Client toggle is prototype-only  (Info)
*Home / Incorporation · timeline editor — Mode toggle*  
Prototype opens the editor in 'Manager · direct edit' with a Manager / Client toggle so the owner can see both. App correctly opens the client version ('Request a timeline change') only.  
**Fix:** None — app correct; the toggle is prototype scaffolding.  
Screens: [app](diff-shots/TL-23-app.webp) · [prototype](diff-shots/TL-23-proto.webp)

### TL-24 · Phase 2 'Filed' = COI date (demo data)  (Info)
*Home · after COI — Timeline card*  
App shows 'Filed 4 Aug' and an MCA review bar with no length. The demo project's steps were completed after its COI date, so the app clamps Phase 2 to COI. Not a design difference.  
**Fix:** None needed; demo data is inconsistent.  
Screens: [app](diff-shots/TL-24-app.webp)

### TL-25 · Phone timeline matches  (Info)
*Home · phone 390 — Timeline card*  
Phone timeline card (bars, Today line, Edit, Open Incorporation link) matches the prototype. Only data differs.  
**Fix:** None.  
Screens: [app](diff-shots/TL-25-app.webp) · [prototype](diff-shots/TL-25-proto.webp)

### TL-26 · COI line faint in both  (Info)
*Incorporation · timeline editor — Editor COI header*  
When the editor is opened from Incorporation, the 'COI 8 Nov' heading is almost invisible. The prototype has the same fault, so it is not a difference, but worth fixing.  
**Fix:** home-tle.css: give the COI heading the ink colour in the Incorporation context.  
Screens: [app](diff-shots/TL-26-app.webp) · [prototype](diff-shots/TL-26-proto.webp)


## Home

### HM-01 · Overdue sent-back item missing from alerts  (High)
*Home · before COI — Important alerts*  
Prototype leads Important alerts with a red overdue hero ('Passport copy sent back · Overdue · Fix'). The app has the same overdue correction (Needs > Correct shows 'Passport copy · Overdue 1d', header says '1 Overdue') but the alerts card shows no hero, only the two dated rows, so the header count and the alerts disagree.  
**Fix:** src/components/client-portal/pages/home/derive.ts buildAlerts(): the before-COI hero only looks at step-level isReviewRejected(); also build the hero from overdue needs (n.kind==='correct' or n.due < today), the same set overdueCount() in CardsA.tsx counts. Copy hero markup from s/home/v7c_alerts_b.dc.html.  
Screens: [app](diff-shots/HM-01-app.webp) · [prototype](diff-shots/HM-01-proto.webp)

### HM-02 · Stray 'Choose File' input visible  (High)
*Home · before COI / after COI — Page (below cards)*  
The app shows a raw browser file input ('Choose File  No file chosen') under the Steps card at the bottom of Home (both states). The prototype has nothing there. The input has the hidden attribute, but its computed display is inline-block, so it still shows.  
**Fix:** src/components/client-portal/pages/home/ui.tsx useNeedUpload() `field`: replace the `hidden` attribute with style={{display:'none'}} (or the sr-only class). Find and remove the CSS that makes [hidden] lose to display:inline-block.  
Screens: [app](diff-shots/HM-02-app.webp)

### HM-03 · Ask VCFO greeting bubble covers bottom sheets  (High)
*Home · before COI · phone 390 / Home · after COI · phone 390 — Bottom sheets*  
On phone, opening any Home bottom sheet (alerts, steps, What SBC is doing, documents) leaves the 'Hello. Ask me anything…' chat bubble on top of the sheet and hides its rows. In the prototype the sheet sits above everything.  
**Fix:** MobileHome.tsx sheet/scrim z-index must sit above the Ask launcher hint (#vp-chat / launcher bubble in css/21-runtime.css), or hide the hint while a sheet is open. Prototype: s/home/mobile.html .sheet.  
Screens: [app](diff-shots/HM-03-app.webp) · [prototype](diff-shots/HM-03-proto.webp)

### HM-04 · Filing name repeats itself  (Medium)
*Home · after COI — What is next / alerts / drills*  
Prototype rows read '<filing> · <period>' ('TDS Payment · Oct 2026'). The app shows 'Advance Tax Payment Q2 · Advance Tax Payment Q2 2026' and 'MSME-1 Filing (Apr-Sep) · MSME-1 Filing (Apr-Sep) 2026' in What is next, its drill, the phone 'Due and overdue' sheet and the Compliance-by-area Period column, because the raw period_label already contains the title.  
**Fix:** derive.ts filingName() and CardsB area table: format the period with displayPeriod(periodStart, periodEnd, periodLabel, fy) from src/lib/client-portal/compliances.ts (as the Compliances pages do). Return periodStart/periodEnd from src/db/repositories/client-home.ts, and drop the label when it starts with the title.  
Screens: [app](diff-shots/HM-04-app.webp) · [prototype](diff-shots/HM-04-proto.webp)

### HM-05 · Drill-down pinned to top, no 'Open full list'  (Medium)
*Home · before COI / after COI — Drill-down pop-up*  
The prototype drill-down (ring, status chips, alerts, legend, post-inc bars) is centred in the viewport and has a footer 'Showing all N · Open full list'. The app's dialog sits about 36px from the top of the screen and its footer only says 'Showing all N'.  
**Fix:** Popups.tsx (drill dialog from PortalProvider.drill): centre it (top:50%; transform:translate(-50%,-50%)) and add the footer link 'Open full list' → config.link.href. Prototype: s/home/v7x_drilldown.dc.html.  
Screens: [app](diff-shots/HM-05-app.webp) · [prototype](diff-shots/HM-05-proto.webp)

### HM-06 · Pop-up scrim leaves sidebar undimmed  (Medium)
*Home · before COI / after COI — Pop-up scrim*  
In the prototype every Home pop-up (drill-down, PAN/TAN password dialog) dims the whole screen, sidebar included. In the app the scrim covers only the main column and top bar, so the navy sidebar stays fully bright and looks clickable.  
**Fix:** Popups.tsx / PortalProvider drill + password dialog: render the scrim in a portal on document.body with a z-index above the shell sidebar (.vps-*), or raise the scrim z-index.  
Screens: [app](diff-shots/HM-06-app.webp) · [prototype](diff-shots/HM-06-proto.webp)

### HM-07 · Who tabs overflow the card  (Medium)
*Home · before COI — Recent activity*  
Prototype seg 'All 4 · SBC 3 · Northwind 1' fits inside the card. In the app the third tab 'Northwind Technologies 2' runs past the card's right edge and gets clipped (desktop and phone; 'Halcyon Payments 2' after COI).  
**Fix:** CardsA.tsx Recent activity Seg (and MobileHome activity seg): use the short company label (shortCompany() in pages/incorporation/data.ts gives 'Northwind'), or let seg buttons shrink with ellipsis (min-width:0; overflow:hidden; text-overflow:ellipsis).  
Screens: [app](diff-shots/HM-07-app.webp) · [prototype](diff-shots/HM-07-proto.webp)

### HM-08 · Document names cut off by owner label  (Medium)
*Home · before COI — Recent documents*  
Prototype rows show the full name ('Director 1 - passport', 'Signed Board Resolution') with a short owner 'Northwind'. In the app the long owner label 'Northwind Technologies' plus the extra preview icon squeeze the name to 'Director 1 …' / 'Signed Bo…'.  
**Fix:** CardsA.tsx DocsCard row: show the short company name, let the owner label truncate before the file name does (owner flex-shrink, name flex:1 1 auto with min-width).  
Screens: [app](diff-shots/HM-08-app.webp) · [prototype](diff-shots/HM-08-proto.webp)

### HM-09 · Sheet tabs overlap each other  (Medium)
*Home · before COI · phone 390 — Bottom sheet tabs*  
Phone 'Incorporation steps' sheet (ring, stat, step taps): the prototype tabs read 'Done 6 · Northwind 3 · SBC 1 · Upcoming 4'. In the app the long 'Northwind Technologies 1' label overlaps 'Done 6' and 'SBC 0', so the text is garbled.  
**Fix:** MobileHome.tsx sheet seg: use the short company name, and make the tab strip horizontally scrollable or ellipsise labels (buttons min-width:0, overflow hidden). Prototype: s/home/mobile.html .sheet .seg.  
Screens: [app](diff-shots/HM-09-app.webp) · [prototype](diff-shots/HM-09-proto.webp)

### HM-10 · Phone lists all 23 registrations  (Medium)
*Home · after COI · phone 390 — Registrations*  
Prototype phone Registrations is a short list: registered rows with Proof, in-progress rows and the next upcoming one (6 rows). The app phone card lists every registration (23 rows, all 'Upcoming'), about 1,300px of scrolling between Company IDs and Post-incorporation.  
**Fix:** MobileHome.tsx registrations card: show done + in progress + the next 1–2 upcoming, and put the rest behind the Registrations sheet / 'Open Incorporation' link, as in s/home/mobile.html#after.  
Screens: [app](diff-shots/HM-10-app.webp) · [prototype](diff-shots/HM-10-proto.webp)

### HM-11 · Stat tile labels wrap to 3 lines  (Low)
*Home · before COI · phone 390 — Greeting stats*  
Prototype phone hero tiles say 'Waiting on Northwind' on two lines. The app's 'Waiting on Northwind Technologies' wraps to three lines, making the first stat row taller than the second, and the hero grows by about 22px.  
**Fix:** MobileHome.tsx hero stats (and CardsA GreetCard): use the short company name for 'Waiting on …', or clamp the label to 2 lines.  
Screens: [app](diff-shots/HM-11-app.webp) · [prototype](diff-shots/HM-11-proto.webp)

### HM-12 · Donut pop-up opens with tooltip open  (Low)
*Home · after COI — Compliance status (donut)*  
Clicking the donut centre opens the 'Compliances · FY 2026-27' table dialog with its (i) popover ('As of 17 Oct 2026 · Ask VCFO about this') already open, because focus lands on the info button. The popover covers the tabs. In the prototype the centre only shows a tooltip.  
**Fix:** Popups.tsx compliance dialog: send initial focus to the dialog title or close button, not the InfoPopover trigger (or only open InfoPopover on click, not on focus).  
Screens: [app](diff-shots/HM-12-app.webp) · [prototype](diff-shots/HM-12-proto.webp)

### HM-13 · Extra ↗ portal icons on desktop  (Low)
*Home · after COI — Company IDs / What is next / Registrations*  
The desktop prototype has none of these. The app adds an external-link icon after each What is next title, a ↗ column on every Company IDs row (even GSTIN '—'), and a ↗ after most Registration names, which crowds the rows.  
**Fix:** CardsB.tsx IdsCard / NextCard / RegistrationsCard: drop the ↗ on desktop (keep it on phone, where s/home/mobile.html has a ↗ button), or confirm with the owner.  
Screens: [app](diff-shots/HM-13-app.webp) · [prototype](diff-shots/HM-13-proto.webp)

### HM-14 · Extra 👁 preview button on desktop  (Low)
*Home · before COI / after COI — Recent documents*  
Prototype desktop rows show only a ⬇ download button (the row itself opens the preview). The app adds a 👁 Preview button on every row. The inventory (RD-03) says 'the board only shows ⬇; the row itself previews'.  
**Fix:** CardsA.tsx DocsCard: remove the Preview icon button on desktop; keep row click → preview. Keep 👁+⬇ on phone (RD-06).  
Screens: [app](diff-shots/HM-14-app.webp) · [prototype](diff-shots/HM-14-proto.webp)

### HM-15 · Drill tabs clipped at right edge  (Low)
*Home · before COI — Drill-down pop-up*  
In the Incorporation steps drill, the app tab strip 'All 14 · Completed 6 · In progress 0 · Waiting for Northwind Technologies 1 · Upcoming 7' is wider than the dialog, so 'Upcoming 7' touches or is cut at the edge. The prototype tabs fit ('Waiting for Northwind').  
**Fix:** Popups.tsx drill tabs: short company name in tab labels, and let the tab row scroll horizontally.  
Screens: [app](diff-shots/HM-15-app.webp) · [prototype](diff-shots/HM-15-proto.webp)

### HM-16 · Need sub-line format differs and wraps  (Low)
*Home · after COI · phone 390 — Needs*  
Prototype phone need rows read '<area> · asked by Priya Raman' ('Payroll · asked by…', 'FC-GPR · asked by…') on one line. The app shows 'Requested by SBC · asked by Sneha Kulkarni', which says the same thing twice and wraps to two lines.  
**Fix:** MobileHome.tsx needs row sub (and derive.ts buildNeeds sub): use '<filing area or step> · asked by <name>'.  
Screens: [app](diff-shots/HM-16-app.webp) · [prototype](diff-shots/HM-16-proto.webp)

### HM-17 · Correction row loses sent-back reason  (Low)
*Home · before COI · phone 390 — Needs · Correct tab*  
Prototype phone correction row: red tile, 'Passport copy — Meera Shah', sub 'Sent back · blurred scan', navy Fix button. The app row shows 'Passport copy' with only 'Overdue 1 day', and does not say why it was sent back.  
**Fix:** MobileHome.tsx needs row for kind 'correct': sub = 'Sent back · <rejection note>' (rejectionNote is already used in buildAlerts).  
Screens: [app](diff-shots/HM-17-app.webp) · [prototype](diff-shots/HM-17-proto.webp)

### HM-18 · Viewer toolbar lacks page counter  (Low)
*Home · before COI / after COI — Document preview (from Recent documents)*  
Prototype viewer bottom toolbar: 'Page 1 / 1 · − 100% +'. The app toolbar has only '− 100% +'.  
**Fix:** Shared doc viewer used by Popups/DocsCard: add the page indicator. Prototype: s/home/v7x_doc_viewer.dc.html.  
Screens: [app](diff-shots/HM-18-app.webp) · [prototype](diff-shots/HM-18-proto.webp)

### HM-19 · Show PAN sheet styling differs  (Low)
*Home · after COI · phone 390 — PAN/TAN reveal sheet*  
Prototype phone 'Show PAN' sheet has a bordered square × and a navy 'Show PAN' button. The app has a plain ×, an extra 'Forgot password?' link, and a grey disabled 'Show PAN' button until something is typed.  
**Fix:** credentials/IDs password sheet used by MobileHome: match s/home/v7p_ids_password.dc.html (390) close-button style. The disabled-until-typed state is fine but should use the navy button at reduced opacity.  
Screens: [app](diff-shots/HM-19-app.webp) · [prototype](diff-shots/HM-19-proto.webp)

### HM-20 · No system events in activity  (Low)
*Home · after COI — Recent activity*  
Prototype after-COI activity includes system rows like 'TDS Payment overdue · VCFO Suite' (red icon on phone). App activity has only people's actions. Check whether overdue and system events are written to the activity feed, or whether this is just the seed.  
**Fix:** src/db/repositories/client-home.ts activity query / jobs that log compliance overdue events; CardsA ActivityCard already renders arbitrary actors.  
Screens: [app](diff-shots/HM-20-app.webp) · [prototype](diff-shots/HM-20-proto.webp)

### HM-21 · Overdue hero button 'Open' vs 'Fill details'  (Info)
*Home · after COI — Important alerts / What is next*  
Prototype's overdue hero shows 'Fill details' (client-owned TDS). The app shows 'Open' because its overdue filing is SBC-owned (Advance Tax). The logic switches correctly by owner.  
**Fix:** App correct; prototype is fake data.  
Screens: [app](diff-shots/HM-21-app.webp) · [prototype](diff-shots/HM-21-proto.webp)

### HM-22 · Proto ring opens wrong sheet after COI  (Info)
*Home · after COI · phone 390 — SETUP ring sheet*  
Prototype phone after-COI ring opens the before-COI 'Incorporation steps' sheet. The app opens 'Post-incorporation setup', which matches the desktop ring and the SETUP label.  
**Fix:** App correct; prototype is fake data.  
Screens: [app](diff-shots/HM-22-app.webp) · [prototype](diff-shots/HM-22-proto.webp)

### HM-23 · Drill link target differs  (Info)
*Home · after COI — What is next drill*  
Prototype What is next drill header says 'These items live in Incorporation · Open Incorporation'. The app says 'These items live in Compliances · Open Compliances', which is the right home for filings.  
**Fix:** App correct; prototype is fake data.  
Screens: [app](diff-shots/HM-23-app.webp) · [prototype](diff-shots/HM-23-proto.webp)

### HM-24 · Upcoming rows show no date  (Info)
*Home · after COI — Registrations*  
Prototype upcoming registrations show a target ('Dec 2026', 'Est. 12 Nov', 'By 2 Dec'). The app shows '—' for every row because the seeded Phase 4 steps have no due dates. derive.ts already renders 'Est.'/'By' when a due exists.  
**Fix:** Data: seed due dates on Phase 4 steps. Optional: month-only format for far-off targets as in v7c_reg.  
Screens: [app](diff-shots/HM-24-app.webp) · [prototype](diff-shots/HM-24-proto.webp)

### HM-25 · Fewer holders and steps listed  (Info)
*Home · before COI — Who holds it now / Steps around*  
Prototype shows 3 Northwind holders (steps 7–9) and 6 'steps around' rows (6–11). The app shows 1 holder and steps 6–8, because in the seed steps 8+ are not started. The window logic (last done → first upcoming) matches.  
**Fix:** Not a design difference (seed data).  
Screens: [app](diff-shots/HM-25-app.webp) · [prototype](diff-shots/HM-25-proto.webp)

### HM-26 · App adds drill on progress bars  (Info)
*Home · before COI — What SBC is doing*  
Clicking an SBC progress bar opens a 'What SBC is doing' drill (In progress / Not started) in the app. The prototype bars only show a tooltip. Alert rows and step titles in the app are also links. These are extra interactions, not regressions.  
**Fix:** None needed; confirm with the owner if strict parity is wanted (CardsA.tsx SbcCard / AlertsCard).  
Screens: [app](diff-shots/HM-26-app.webp) · [prototype](diff-shots/HM-26-proto.webp)


## Incorporation

### IN-01 · Row icons invisible: empty white squares  (High)
*Phase page · step 2 — Steps table (? and → buttons)*  
Prototype: every step row ends with a (?) What's this button and a → open button; SBC rows also show the ↗ portal icon and done rows a paperclip. App: both buttons are empty white squares and the ↗/paperclip icons and the column header glyphs are missing. Cause: the global rule `.cp .ic{color:#fff;width:30px;...}` in css/10-base.css also matches the incorporation `<svg class="ic">`, so every stroke icon on a white surface is painted white.  
**Fix:** Scope the base rule (css/10-base.css line 28) to the Home tiles it was written for (e.g. `.cp .cp-home .ic`), or rename the incorporation icon class in pages/incorporation/ui.tsx `Ic` (e.g. `inc-ic`) and add `color:currentColor`. Same rule applies to every row below that mentions invisible icons.  
Screens: [app](diff-shots/IN-01-app.webp) · [prototype](diff-shots/IN-01-proto.webp)

### IN-02 · Stroke icons white everywhere on white  (High)
*All incorporation pages — Icons (global CSS collision)*  
Same root cause seen on every page: the Steps chevron and Open → arrow on the landing, the (i) next to TIMELINE and PROGRESS, the back chevron and the What's this? (?) on step pages, the Request a change / Approve icons, the owner/⋮/(?) icons in the step-page phase list, the tab check on done steps, the × on the status-brief drawer and the focus-card (?) are all invisible. Prototype shows all of them in muted grey/primary.  
**Fix:** css/10-base.css: `.cp .ic{...color:#fff}` collides with `Ic` in src/components/client-portal/pages/incorporation/ui.tsx. Fix once (scope or rename) and re-check the landing, phase, step and board pages.  
Screens: [app](diff-shots/IN-02-app.webp) · [prototype](diff-shots/IN-02-proto.webp)

### IN-03 · Body says 'not ready' while hero says received  (High)
*Board resolution · before COI — Page body*  
Prototype: under the hero a tracker (Drafted → Released → Signed → Received), the PREVIEW card with the paper copy and zoom, the FILES card (draft .docx, signed .pdf, Replace signed copy drop zone) and the 'What happens with it' bot card. App: the hero says 'Signed copy received · 29 Sep' with a done glyph, but the only card says 'The board resolution is not ready yet…' and nothing else is shown. The page contradicts itself whenever steps 2–3 are done but no finalized board-resolution file exists (true for the seeded engagement).  
**Fix:** pages/incorporation/BoardPage.tsx: when `s3.kind==='done'` (or ex.receivedAt) render the tracker and files from step 2/3 dates and attachments even without `doc.status==='finalized'`; only show the 'not ready yet' bot when step 2 is not done. Also seed a finalized board-resolution doc for the demo client.  
Screens: [app](diff-shots/IN-03-app.webp) · [prototype](diff-shots/IN-03-proto.webp)

### IN-04 · No Documents card, drop zone or NOC request  (High)
*Step 7 (pre-14) · before COI — Documents card*  
Prototype: a DOCUMENTS card with (i), amber '1 of 2' chip, the request line 'No-objection certificate … requested by Arjun', a dashed amber NOC drop zone (upload button, 'Drop a file here or browse', 'Due 9 Oct') and the uploaded utility bill row with preview/download. App: no Documents card at all; 'No-objection certificate from the owner' and 'Copy of utility bill' appear as plain answer rows showing '—'. The card only renders when a lead document request exists (none in the seed), and file-type fields are not routed to it.  
**Fix:** StepPage.tsx: build the Documents card from getStepAttachmentRequirements(item,…) (file fields) as well as document requests, and drop file-type fields from the answers `dl`. Seed an open NOC request on pre-14 for the demo client so the drop zone and Approve-blocking can be seen.  
Screens: [app](diff-shots/IN-04-app.webp) · [prototype](diff-shots/IN-04-proto.webp)

### IN-05 · Owner chip overlaps the row text  (High)
*Landing · before COI — This week card*  
Prototype: short owner chip 'Northwind' / 'SBC' in an 80 px column, then the task, then a mono date. App: the chip reads 'Northwind Technologies', is clipped to 'Northwind Tech' and its text runs over the task title ('Registered Office Address' is unreadable).  
**Fix:** pages/incorporation/Landing.tsx week rows: use the short client name (first word, as the prototype 'Northwind') and give `.week .own` `overflow:hidden;text-overflow:ellipsis` in incorporation-landing.css.  
Screens: [app](diff-shots/IN-05-app.webp) · [prototype](diff-shots/IN-05-proto.webp)

### IN-06 · Bar floats mid-page, buttons hidden  (High)
*Step 7 (pre-14) · before COI — Approve & submit bar*  
Prototype: the 'Awaiting Northwind's approval' bar is pinned to the bottom edge of the window with Request a change and Approve & submit on the right. App (1440): the bar sits right under the short content at y≈730 with empty page below it, and its buttons are covered by the auto-opened Ask VCFO greeting; the launcher is not lifted above the bar.  
**Fix:** StepPage.tsx `.act`: give `.wrap.na` `min-height:calc(100dvh - topbar)` with the bar last (or use position:fixed inside main) so it always sits at the window bottom; set `--acth` so the Ask VCFO launcher/greeting sits above it (prototype `.has-act #vp-launch{bottom:var(--acth)}`).  
Screens: [app](diff-shots/IN-06-app.webp) · [prototype](diff-shots/IN-06-proto.webp)

### IN-07 · Uses 'Northwind Technologies' instead of 'Northwind'  (Medium)
*Landing / phase / step · before COI — Client name (short form)*  
Prototype uses the short name 'Northwind' in owner chips, donut titles ('Documents from Northwind', 'Signed by Northwind'), the This week chip and copy ('Northwind's team…', 'Awaiting Northwind's approval'). App uses 'Northwind Technologies' everywhere, which truncates chips ('Northwind Techn' runs into the Status column), wraps the donut title and legend to two lines, and produces 'Northwind Technologies's'.  
**Fix:** Derive the short name as the prototype does (first word of the company, or a stored short name) in the incorporation data builder (pages/incorporation/data.ts `d.short`), and use `’` only for names ending in s.  
Screens: [app](diff-shots/IN-07-app.webp) · [prototype](diff-shots/IN-07-proto.webp)

### IN-08 · Owner chip overflows into Status  (Medium)
*Phase page · step 2 — Steps table owner column*  
Prototype: 'Northwind' chip fits the Owner column. App: 'Northwind Techn' is cut and touches/overlaps the Status chip on every client-owned row.  
**Fix:** PhasePage.tsx step table + incorporation-pages.css: short name, plus `overflow:hidden;text-overflow:ellipsis;max-width:100%` on the owner chip.  
Screens: [app](diff-shots/IN-08-app.webp) · [prototype](diff-shots/IN-08-proto.webp)

### IN-09 · Company line indented 38 px  (Medium)
*Landing · before COI — Days-to-COI tile*  
Prototype: 'Northwind Technologies India Pvt Ltd · expected Wed 28 Oct' starts at the tile's left edge under '22'. App: the line is pushed right by 38 px (phone too), because the base rule `.cp .sub{padding-left:38px;min-height:32px}` in css/10-base.css also hits `.coi .sub`.  
**Fix:** Add `padding-left:0;min-height:0` to `.cp .cp-incorporation .coi .sub` in incorporation-pages.css, or scope the base `.sub` rule.  
Screens: [app](diff-shots/IN-09-app.webp) · [prototype](diff-shots/IN-09-proto.webp)

### IN-10 · Label shouted in uppercase, wraps on phone  (Medium)
*Step 7 (pre-14) · before COI — Approve & submit bar label*  
Prototype: sentence case 'Awaiting Northwind's approval' (13.5 px bold). App: 'AWAITING NORTHWIND TECHNOLOGIES'S APPROVAL' in letter-spaced caps, because the base `.cp .st` (uppercase label style) matches the bar's `.st`; on 390 it wraps to two clipped lines ('AWA / APPI').  
**Fix:** Rename the bar's `.st` class in StepPage.tsx or reset `text-transform:none;letter-spacing:normal` under `.cp-incorporation .act .st`.  
Screens: [app](diff-shots/IN-10-app.webp) · [prototype](diff-shots/IN-10-proto.webp)

### IN-11 · SBC-owned steps list only 'Remarks'  (Medium)
*Step 10 (pre-7) / step 2 (pre-2) — Answers card rows*  
Prototype: step 10 lists what it captures (KYC review status, DSC messages ×2, Date/Place of signing, Witness, Other attachments, Remarks, each '—'); done step 2 lists three 'Provided · 18 Sep' rows. App shows only 'Remarks (optional) —', so the card says 'Here is what it captures' and then captures nothing.  
**Fix:** StepPage.tsx liveRows: for SBC-owned steps show the item's infoRequired labels (read-only, value '—' or 'Provided · date' when done) instead of filtering them away with filterFieldsByViewer; keep values hidden if needed, but keep the labels.  
Screens: [app](diff-shots/IN-11-app.webp) · [prototype](diff-shots/IN-11-proto.webp)

### IN-12 · '34 days early' measured against COI date  (Medium)
*Phase 1 page — Progress card · early/late*  
Prototype: phase 1 finished 1 Oct against its own plan end → 'Finished 1 Oct · 3 days late'. App: phase 1 (done 5 Oct) shows '34 days early', i.e. it compares with the whole incorporation window end (8 Nov), not phase 1's planned end. The same value appears on the landing Part A row.  
**Fix:** PhasePage.tsx phase plan (`plan[1]` for phase 1): use phase 1's own planned window from engagement.schedule / step windows, not the COI window end.  
Screens: [app](diff-shots/IN-12-app.webp) · [prototype](diff-shots/IN-12-proto.webp)

### IN-13 · Dates missing for not-started phases  (Medium)
*Phase 3 / Phase 4 pages — Hero meta + key dates*  
Prototype: hero meta '0/23 · 28 Oct → 27 Dec · ends 27 Dec 2026', progress label '… Ends 27 Dec', and chips 'Starts 28 Oct' / 'Ends 27 Dec'. App: meta is just '0/23', no Ends label, and the Starts/Ends chips are missing (only Now and Reviewer).  
**Fix:** PhasePage.tsx: when a phase has no stored window, derive start = expected COI and end = latest planned step date (prototype phEnd) as the prototype does, so the meta and chips always render.  
Screens: [app](diff-shots/IN-13-app.webp) · [prototype](diff-shots/IN-13-proto.webp)

### IN-14 · Extra 'Monthly status brief' button  (Medium)
*Landing · before COI — Days-to-COI tile*  
Prototype FINAL has no status-brief entry on the landing (the hero was removed; inventory §0.1 flags it for owner decision). App adds a 'Monthly status brief' outline button inside the navy tile (icon-only on phone), making the tile taller than the This week card and leaving it half empty.  
**Fix:** Confirm with the owner; if kept, move it to the page-header area or a small icon button beside the (i) in Landing.tsx so the COI tile keeps the prototype height.  
Screens: [app](diff-shots/IN-14-app.webp) · [prototype](diff-shots/IN-14-proto.webp)

### IN-15 · Drawer close × invisible, empty 'In progress'  (Low)
*Landing · before COI — Monthly status brief drawer*  
App drawer matches the spec (highlight, PHASES rows, WAITING ON…, Copy brief / Download PDF), but the × close button is a blank white square and 'Copy brief' has no icon (icon collision), and the IN PROGRESS heading is shown with nothing under it instead of an empty-state line.  
**Fix:** StatusBrief.tsx: fix the icon class; hide the IN PROGRESS section or show the bot 'Nothing in progress.' when empty.  
Screens: [app](diff-shots/IN-15-app.webp)

### IN-16 · Empty tabs shown with 0  (Low)
*Landing · before COI — Donut drill pop-up*  
Prototype drill renders only non-empty segment tabs (spec LS-05) — with seed data every tab is non-empty. App renders all four tabs including 'Submitted 0', 'Under review 0', 'Sent back 0', which lead to empty lists.  
**Fix:** Drill builder in Landing.tsx (drillSeg): filter out tabs with count 0 (keep the active one).  
Screens: [app](diff-shots/IN-16-app.webp) · [prototype](diff-shots/IN-16-proto.webp)

### IN-17 · No document-request / approve rows  (Low)
*Landing · before COI — This week card*  
Prototype rows mix task types: 'Upload NOC · requested by Arjun', 'Check & approve step 7', plus SBC work ('KYC review & DSC', 'Draft MOA & AOA'). App lists only step titles ('Registered Office Address'), so open document requests and the approve action never appear here.  
**Fix:** Landing.tsx week rows: add one row per open document request ('Upload <doc> · requested by <lead>') and an 'Check & approve step N' row for steps awaiting client approval.  
Screens: [app](diff-shots/IN-17-app.webp) · [prototype](diff-shots/IN-17-proto.webp)

### IN-18 · 'Ends 28 Oct' / 'Finished …' text missing  (Low)
*Phase page · step 2 — Progress card label*  
Prototype progress label: '11% 1 / 9 steps Ends 28 Oct' (done phase: 'Finished 1 Oct · 3 days late'). App shows only '11% 1 / 9 steps' and, for phase 1, only the early/late part.  
**Fix:** PhasePage.tsx progress label (around line 341): the Ends/Finished span is not rendering — check the condition on endD.  
Screens: [app](diff-shots/IN-18-app.webp) · [prototype](diff-shots/IN-18-proto.webp)

### IN-19 · Crumb adds 'Step 7 ·' prefix  (Low)
*Step pages — Breadcrumb*  
Prototype: Home / Incorporation / SPICe+ Part B / Registered Office Address. App: '… / Step 7 · Registered Office Address' (same on step 2 and 10), which also truncates sooner on phone.  
**Fix:** Step page crumb in app/app/client/incorporation/step/[stepId]/page.tsx (or IncFrame): drop the 'Step N ·' prefix.  
Screens: [app](diff-shots/IN-19-app.webp) · [prototype](diff-shots/IN-19-proto.webp)

### IN-20 · Banner says 'Completed · Delivered by SBC'  (Low)
*Step 2 (pre-2) · done — Approved banner*  
Prototype: 'Approved · Accepted after submission on 18 Sept 2026' for every done step. App: SBC-owned done steps show 'Completed · Delivered by SBC on 25 Sept 2026' (client steps keep 'Approved'). App wording is arguably more accurate; confirm with the owner.  
**Fix:** StepPage.tsx (~line 629): keep, or switch to prototype wording if the owner wants one label.  
Screens: [app](diff-shots/IN-20-app.webp) · [prototype](diff-shots/IN-20-proto.webp)

### IN-21 · Two-tone background under short pages  (Low)
*Step pages (short content) — Page background*  
On short step pages (step 2, step 10) the app shows a lighter band starting below the content (y≈545 on step 2), as if the scroll area ends there. Prototype background is one uniform colour to the bottom.  
**Fix:** Check `.wrap.na` / main min-height and background in incorporation-pages.css; let the page background fill the viewport.  
Screens: [app](diff-shots/IN-21-app.webp) · [prototype](diff-shots/IN-21-proto.webp)

### IN-22 · Phone '← Phase 1 / Phase 3 →' bar unreadable  (Low)
*Phase page · step 2 · phone — Prev/next phase bar*  
Prototype phone shows a two-button bar '← Phase 1' / 'Phase 3 →' under the cards. App renders the bar but its arrows are invisible (icon collision) and it is covered by the auto-opened Ask VCFO greeting.  
**Fix:** PhasePage.tsx `.pn` (line ~430): icon fix; Ask greeting should not auto-open over page content (shell).  
Screens: [app](diff-shots/IN-22-app.webp) · [prototype](diff-shots/IN-22-proto.webp)

### IN-23 · Accordion matches; only chips/icons differ  (Low)
*Landing · before COI — Phase accordion (Steps)*  
Opening Steps under SPICe+ Part B matches the prototype closely (header STEP/OWNER/STATUS/DATE/PORTAL·PROOF, gold-barred Waiting row, 'Next' chip, MCA owner for 13/14, Open buttons; phone hides columns correctly). Remaining gaps are the missing → on Open, invisible ↗ portal icons and the truncated owner chip covered above.  
**Fix:** See icon and short-name rows.  
Screens: [app](diff-shots/IN-23-app.webp) · [prototype](diff-shots/IN-23-proto.webp)

### IN-24 · Counts differ only by seed data  (Info)
*Landing · before COI — Donut cards*  
Prototype shows hand-picked document counts (12 from Northwind, 14 SBC) and 3 on-time steps; app shows 2 pending / 0 / 1 at risk from the real seed. Layout, colours, legend buttons and drill-downs match.  
**Fix:** App correct; prototype is fake data.  
Screens: [app](diff-shots/IN-24-app.webp) · [prototype](diff-shots/IN-24-proto.webp)

### IN-25 · SPICe+ ring / All steps / Who drills match  (Info)
*Landing · before COI — Drill-downs (ring, steps pill, who)*  
Clicking the SPICe+ ring, the '6 / 48 steps' pill and a 'Who's working on what' legend opens the same pop-up as the prototype (link strip, title/sub, tab pill, rows with date + status chip + →, 'Showing all N'). Fewer tabs only because the seed has no In progress / With SBC steps.  
**Fix:** No change.  
Screens: [app](diff-shots/IN-25-app.webp) · [prototype](diff-shots/IN-25-proto.webp)

### IN-26 · Days-to-COI pop-over matches  (Info)
*Landing · before COI — (i) info pop-over*  
Same text, width, anchor and 'Ask VCFO about this' row as the prototype; only the date differs (data).  
**Fix:** No change.  
Screens: [app](diff-shots/IN-26-app.webp) · [prototype](diff-shots/IN-26-proto.webp)

### IN-27 · Chat behaviour matches prototype  (Info)
*Step 7 (pre-14) · before COI — What's this? / Request a change*  
What's this? opens Ask VCFO with the step answer card (title, text, Why it matters, Source, Open this step). Request a change posts 'I want to request a change to step 7 · …' to the chat, exactly like the prototype (the spec's dialog-based ClientChangeRequestButton is not used by the action bar).  
**Fix:** Optional: route the action-bar Request a change to the existing change-request dialog in StepPage.tsx if the owner wants a real request.  
Screens: [app](diff-shots/IN-27-app.webp) · [prototype](diff-shots/IN-27-proto.webp)

### IN-28 · Could not verify blocking in app  (Info)
*Step 7 (pre-14) · before COI — NOC blocking on Approve*  
Prototype: Approve & submit without the NOC shows toast 'Upload the NOC first · it is still needed from Northwind'. App code scrolls to and pulses the drop zone, but with no NOC request seeded there is no drop zone; not clicked in the app (it would submit).  
**Fix:** Re-test after seeding an NOC request (see Documents card row).  
Screens: [prototype](diff-shots/IN-28-proto.webp)

### IN-29 · Step 8–10 statuses differ by seed  (Info)
*Phase / step pages — Statuses and dates*  
Prototype has steps 8/9 In progress and 10 With SBC; the app seed has them Upcoming, so glyphs, chips, rail sub-lines and 'Who's working' splits differ. Dates differ by the seed's schedule (7 Oct → 8 Nov vs 29 Sep → 28 Oct).  
**Fix:** App correct; prototype is fake data.  
Screens: [app](diff-shots/IN-29-app.webp) · [prototype](diff-shots/IN-29-proto.webp)

### IN-30 · MCA segment added  (Info)
*Phase page · step 2 — Who's doing it*  
Prototype phase page shows Northwind 5 / SBC 4 (steps 13–14 as SBC). App adds a violet MCA segment (2), matching the landing FINAL rule LOWN={13:'MCA',14:'MCA'}. Consistent with the landing; fine.  
**Fix:** No change (or align the prototype phase page).  
Screens: [app](diff-shots/IN-30-app.webp) · [prototype](diff-shots/IN-30-proto.webp)


## Compliances

### CP-01 · Compact donut renders as tall stacked column  (High)
*Compliances Calendar · after COI — Donut card (right rail)*  
The prototype shows a compact card: the 88 px donut on the left and the 4-row legend beside it, about 115 px tall. In the app the legend drops under the donut with large gaps between rows, so the card is about 350 px tall and pushes Next deadline and Coming up down. The cause is the generic `.cp .card{flex-direction:column}` rule in 23-portal.css, which beats the board's `.donut` flex row.  
**Fix:** css/compliances-board.css: add `.cp .cp-compliances .donut{flex-direction:row}` (or set flexDirection:'row' inline in src/components/client-portal/pages/compliances/DonutCard.tsx). Copy prototype donutCard() in s/comp/index.html I:780-786.  
Screens: [app](diff-shots/CP-01-app.webp) · [prototype](diff-shots/CP-01-proto.webp)

### CP-02 · Filings donut stacked; KPI row about 350 px tall  (High)
*Compliances Filings · after COI — KPI row (donut + By area)*  
In the prototype the KPI row is about 180 px tall: a compact donut with the legend beside it, next to the By-area bars. In the app the same `.card` column rule stacks the legend under the donut, and the By-area card stretches to match, leaving a large empty block. This happens at 1440, 1024 and 390.  
**Fix:** Same fix as the calendar donut: force `.donut` to flex-direction:row in css/compliances-board.css (src/components/client-portal/pages/compliances/DonutCard.tsx is shared by both pages).  
Screens: [app](diff-shots/CP-02-app.webp) · [prototype](diff-shots/CP-02-proto.webp)

### CP-03 · Period repeats the filing name  (High)
*Compliances Calendar · after COI — Next deadline card / every period label*  
The prototype title is 'GSTR-1 · Sep 2026': name plus a short period ('Sep 2026', 'Jul–Sep 2026', 'FY 2025-26'). The app shows 'MSME-1 (Apr–Sep) · MSME-1 Filing (Apr–Sep) 2026'. Its `period` is the register's particular plus a year, so the name appears twice. The same wrong period shows in the day pop-over, detail pop-up (title and Period fact), drill-down Period column and Filings table sub-line.  
**Fix:** Build `period` in src/db/repositories/client-compliances.ts (or displayPeriod in src/lib/client-portal/compliances.ts) from period_start/period_end ('Sep 2026', 'Jul–Sep 2026', 'FY 2025-26'), as BUILD inventory §2 says. Do not reuse periodLabel.  
Screens: [app](diff-shots/CP-03-app.webp) · [prototype](diff-shots/CP-03-proto.webp)

### CP-04 · Phone donut card is 3× too tall  (Medium)
*Compliances Filings · phone 390 — KPI row (donut)*  
On the phone the prototype keeps the donut and legend side by side in a 105 px card. The app stacks them (about 350 px), so the table starts below the first screen.  
**Fix:** Same `.donut{flex-direction:row}` fix; keep `flex-wrap:wrap` at ≤767 so it wraps only when it really lacks room.  
Screens: [app](diff-shots/CP-04-app.webp) · [prototype](diff-shots/CP-04-proto.webp)

### CP-05 · Default 'Monthly' view is empty  (Medium)
*Compliances Filings · after COI — Cadence pill default*  
In the prototype Monthly is selected but the table still lists every filing in Sep–Oct (17 rows across frequencies). The app really filters by cadence and defaults to Monthly. The register has no monthly filings, so the page opens with 0/0 bars, a 0 donut and 'No filings here yet'. All 5 filings sit under Quarterly/Annual.  
**Fix:** FilingsPage.tsx useFilingsState: default cadence to the first one with rows in the window (or add an 'All' option first). The seed's missing monthly obligations are a data matter (inventory §2.6).  
Screens: [app](diff-shots/CP-05-app.webp) · [prototype](diff-shots/CP-05-proto.webp)

### CP-06 · Date tiles lack month across months  (Medium)
*Compliances Calendar · after COI — Coming up rail*  
The prototype's Coming up holds only this month's dates, so 'WED 7' is clear. The app lists the next deadlines of the whole year ('31 SAT', '15 TUE', '15 MON'). Two '15' tiles with no month (Dec and Mar) are ambiguous.  
**Fix:** CalendarPage.tsx ComingUp: when a date is not in the current month, show the month in the tile (e.g. '15 / DEC'), or limit the list to the current month as the prototype does (C-24).  
Screens: [app](diff-shots/CP-06-app.webp) · [prototype](diff-shots/CP-06-proto.webp)

### CP-07 · Phone agenda: no month, overdue missing  (Medium)
*Compliances Calendar · phone 390 — Agenda under the week strip*  
The prototype agenda starts at this week and includes yesterday's filed and overdue rows. The app agenda starts from today. The Overdue KPI says 1, but the overdue Advance Tax Q2 is not in the list. The following rows jump to Dec/Mar with tiles that show only '15 TUE' / '15 MON'.  
**Fix:** CalendarMobile.tsx agenda: put overdue rows first (or include them), and add the month to tiles outside the current month.  
Screens: [app](diff-shots/CP-07-app.webp) · [prototype](diff-shots/CP-07-proto.webp)

### CP-08 · Info pop-over clipped by the card  (Medium)
*Compliances Calendar · after COI — Next deadline (i) pop-over*  
Clicking (i) opens a 280 px pop-over centred on the icon. The card's overflow:hidden cuts it off: the left side in the app ('SME-1 (Apr–… ep) 2026'), the right side in the prototype. The text is unreadable at the edge.  
**Fix:** CalendarPage.tsx NextDeadlineCard: allow overflow (use overflow:visible and clip only the footer strip), or render InfoPopover (shared.tsx) in a portal with viewport clamping.  
Screens: [app](diff-shots/CP-08-app.webp) · [prototype](diff-shots/CP-08-proto.webp)

### CP-09 · Phone sheet: track overlaps, footer squeezed  (Medium)
*Compliances Filings · phone 390 — Side panel as bottom sheet*  
On the phone the sheet's focus track labels overlap ('SBC preparingHalcyon Payme…') and the last node is cut off. The footer squeezes 'Ask VCFO about this filing' into 3 lines next to two buttons.  
**Fix:** Detail.tsx SidePanel/DetailModal: on ≤767 use a vertical focus track and stack the footer (Ask row full width, then buttons).  
Screens: [app](diff-shots/CP-09-app.webp)

### CP-10 · Today tint lost on weekend days  (Low)
*Compliances Calendar · after COI — Month grid · today cell*  
In the prototype, today is the whole cell outlined in navy and tinted #eef2f8. Today in the app is Sat 17 Oct: the navy outline shows, but the cell stays white. The rule `.cal .day.we:not(.out)` (white) is more specific than `.cal .day.today`. The same CSS sits in the prototype but never shows there because its today is a Thursday.  
**Fix:** css/compliances-board.css: raise specificity, e.g. `.cp .cp-compliances .cal .day.today:not(.out)` with the #eef2f8 tint.  
Screens: [app](diff-shots/CP-10-app.webp) · [prototype](diff-shots/CP-10-proto.webp)

### CP-11 · Filed bars not faded/locked  (Low)
*Compliances Calendar · Timeline view — Bars · filed*  
In the prototype a filed bar (TDS/TCS challan) is green at opacity .75 with a default cursor, so it reads as locked. In the app the filed DIR-3 KYC bar is full-strength green (`.tlv-b.lock.ro{opacity:1}`), so it looks the same weight as live work.  
**Fix:** css/compliances-board.css: drop the `.tlv-b.lock.ro{opacity:1}` override (keep .lock opacity .75).  
Screens: [app](diff-shots/CP-11-app.webp) · [prototype](diff-shots/CP-11-proto.webp)

### CP-12 · Tile sub-label 'OCT · SAT' crammed  (Low)
*Compliances Calendar · detail pop-up — Header date tile*  
The 56×62 tile in the prototype wraps 'OCT · TUE' onto two short lines. In the app 'OCT · SAT' / 'SEP · WED' runs edge to edge (or wraps unevenly) inside the tile.  
**Fix:** Detail.tsx DetailModal: put the month and weekday on separate lines or drop the weekday (e.g. small 'OCT' + tiny 'SAT').  
Screens: [app](diff-shots/CP-12-app.webp) · [prototype](diff-shots/CP-12-proto.webp)

### CP-13 · Portal tooltip covers the title on open  (Low)
*Compliances Calendar · detail pop-up / Filings panel — Initial focus*  
When the pop-up or panel opens, focus lands on the ↗ portal button, so its navy 'Open MCA portal' tooltip sits over the title. The prototype opens with no tooltip.  
**Fix:** Detail.tsx useModal: focus the dialog container or the Close button first, and show focus tooltips only for :focus-visible from the keyboard.  
Screens: [app](diff-shots/CP-13-app.webp) · [prototype](diff-shots/CP-13-proto.webp)

### CP-14 · Long month name overflows donut hole  (Low)
*Compliances Calendar · Sep 2026 — Donut centre label*  
The prototype's 'October' fits inside the 58 px hole. In the app, 'September' (and 'November', 'December') touches or overlaps the ring.  
**Fix:** DonutCard.tsx: use the short month in the hole ('Sep') or shrink the font to 10 px for labels over 7 characters.  
Screens: [app](diff-shots/CP-14-app.webp) · [prototype](diff-shots/CP-14-proto.webp)

### CP-15 · 'Proof pending' shown twice  (Low)
*Compliances Filings · side panel — Proof block*  
In the app a filed item with no proof shows the amber 'Proof pending' chip in the header and again as the only content of the PROOF section. The prototype shows the proof chip once in the header and file cards (with 👁 / ⬇) in PROOF.  
**Fix:** Detail.tsx SidePanel: in the PROOF section use a sentence ('SBC will upload the challan / acknowledgement here') or a bot line instead of a second chip.  
Screens: [app](diff-shots/CP-15-app.webp) · [prototype](diff-shots/CP-15-proto.webp)

### CP-16 · Range is whole FY, not Sep–Mar  (Info)
*Compliances Calendar · Timeline view — Range / lanes*  
The prototype window is fixed from 1 Sep 2026 to 31 Mar 2027. The app covers the whole FY (1 Apr → 31 Mar), so you can pan back to April. Both start scrolled to the current month at about 2 months on screen, with the same ruler, Weeks/Days/Months levels, red Today tag, area header lanes and diamonds. The inventory recommends this.  
**Fix:** None (App correct; prototype range is fake-data).  
Screens: [app](diff-shots/CP-16-app.webp) · [prototype](diff-shots/CP-16-proto.webp)

### CP-17 · Bar click opens detail (app only)  (Info)
*Compliances Calendar · Timeline view — Bar interaction*  
In the prototype a bar is a role=slider: click/drag edits the window and nothing opens. In the app a bar is a button: click or Enter opens the filing detail pop-up. A filed bar's tooltip ends with '· filed' and a set window with '· set by SBC'.  
**Fix:** None. Keep it; it goes with the read-only decision.  

### CP-18 · Area counts switch to FY totals  (Info)
*Compliances Calendar · Year / Timeline — Area pill counts*  
The prototype keeps the month counts on the area pill in every view (All 13). The app shows month counts in Month view and FY counts in Year/Timeline (All 5 vs All 1). This is arguably better and only differs from the static prototype.  
**Fix:** None (App correct; prototype counts are fixed demo values).  
Screens: [app](diff-shots/CP-18-app.webp) · [prototype](diff-shots/CP-18-proto.webp)

### CP-19 · Extra 'Tip: click any date' bubble  (Info)
*Compliances Calendar · after COI — First-time tip*  
The app shows a bot bubble 'Tip: click any date to see its filings. [Got it]' above the grid until it is dismissed. That pushes the month about 90 px down, so the last week no longer fits at 1440×900. The prototype has no tip on the live board. It is spec'd as E-06.  
**Fix:** None (inventory E-06). Optionally overlay it on the grid instead of above it, so the whole month still fits at 1440×900 (owner layout note in calRedesign).  
Screens: [app](diff-shots/CP-19-app.webp) · [prototype](diff-shots/CP-19-proto.webp)

### CP-20 · Donut says 0 overdue, card shows overdue  (Info)
*Compliances Calendar · after COI — Overdue footer vs October donut*  
The October donut and its drill-down say 'Overdue 0 · Nothing overdue. Nice work.', while the Next deadline footer shows 'Advance Tax Payment Q2 · 32 days late' (a September item). The footer drill correctly opens 'Compliances · FY 2026-27' with Overdue 1. The prototype's overdue item happens to sit in October, so the two agree there.  
**Fix:** App correct; prototype is fake data. Optionally add 'carried over' rows to the month drill's Overdue tab.  
Screens: [app](diff-shots/CP-20-app.webp) · [prototype](diff-shots/CP-20-proto.webp)

### CP-21 · No draft note; some facts empty  (Info)
*Compliances Calendar · detail pop-up — Facts / gold note*  
The prototype shows a gold 'SBC will send the draft for Northwind's approval by 17 Oct.' note and the period '1–30 Sep 2026'. The app shows the note only when draftDueOn is set (none in the seed), and Period falls back to the long label.  
**Fix:** Data only (seed has no draft/period dates). Structure is in Detail.tsx.  
Screens: [app](diff-shots/CP-21-app.webp) · [prototype](diff-shots/CP-21-proto.webp)

### CP-22 · ARN, tax and proof cards absent (data)  (Info)
*Compliances Filings · side panel — ARN / Tax paid / proof files*  
The prototype's filed GSTR-3B shows ARN, Tax paid, Filed by and two PDF cards with Preview/Download. The app shows only Due date and 'Filed by SBC · 30 Sep 2026', because the seed filing has no acknowledgement number, amount or proof. The code renders those facts when present.  
**Fix:** Data only. Seed a filed instance with acknowledgement_no, amount_paid and a proof to demo the panel.  
Screens: [app](diff-shots/CP-22-app.webp) · [prototype](diff-shots/CP-22-proto.webp)

### CP-23 · Month abbreviation 'Sep' vs 'SEPT'  (Info)
*Compliances Filings · after COI — Table date tiles*  
Prototype tiles and 'Filed on' read 'SEPT' / '14 Sept' (en-IN locale). The app uses 'SEP' / '14 Sep'.  
**Fix:** None. The app's 3-letter month is the cleaner choice.  
Screens: [app](diff-shots/CP-23-app.webp) · [prototype](diff-shots/CP-23-proto.webp)

### CP-24 · Row opens side panel (proto unwired)  (Info)
*Compliances Filings · after COI — Row click*  
Clicking a table row in the live prototype does nothing; the side panel exists only as a static board. The app opens the right side panel with an Esc/scrim close and keeps ?filing= in the URL.  
**Fix:** None (App correct; follows inventory F-07).  
Screens: [app](diff-shots/CP-24-app.webp) · [prototype](diff-shots/CP-24-proto.webp)

### CP-25 · Tapping a day filters agenda (app only)  (Info)
*Compliances Calendar · phone 390 — Week strip tap*  
The prototype's phone strip is static. In the app, tapping a day outlines it and replaces the agenda with that day's filings, or the bot line 'Nothing is due on this day.'  
**Fix:** None. It is an enhancement.  
Screens: [app](diff-shots/CP-25-app.webp) · [prototype](diff-shots/CP-25-proto.webp)

### CP-26 · Picker, pop-over, drill-down, Year view match  (Info)
*Compliances Calendar · after COI — Month/Year picker, day pop-over, drill-down, year view*  
The month picker (3×4 grid, current month navy, Today footer) and year picker, the day pop-over (status tile, row with area chip, ↗, status chip, Ask VCFO, free-day bot), the status drill-down dialog (top link bar, tabs with counts, table, footer) and the Year view (lined mini-months, worst-status fills, dot summary, today box) all match the prototype. Only the data differs.  
**Fix:** None.  
Screens: [app](diff-shots/CP-26-app.webp) · [prototype](diff-shots/CP-26-proto.webp)

### CP-27 · Header, filters and table match  (Info)
*Compliances Filings · after COI — Header / filters / table*  
The FY stepper, Monthly/Quarterly/Annual pill, ⬇ Export (CSV download), Calendar link, area and status pills (with dots), the 'Sep – Oct 2026' window with ‹ › and Full year, column set, date tiles, ↗ portal links, 'N days late' / 'in N days', and the Proof column (— / Proof pending / Proof + ⬇) all match. The app also adds working 'Add to my calendar' (.ics) and 'Remind me' buttons in the side panel for unfiled items (not clicked here because they write).  
**Fix:** None.  
Screens: [app](diff-shots/CP-27-app.webp) · [prototype](diff-shots/CP-27-proto.webp)


## Documents & Library

### DC-01 · Native 'Choose File' input visible in dialog  (High)
*Documents · desktop — Upload dialog*  
Prototype dialog has only the dashed drop zone ('Drop files here or browse'). App also shows the raw browser control 'Choose File  No file chosen' under the drop zone.  
**Fix:** src/components/client-portal/pages/documents/UploadDialog.tsx: the hidden <input type=file> is made visible because an unlayered 'input{display:inline-block}' rule beats the [hidden] rule. Use style={{display:'none'}} (or the vdoc-sr class) instead of relying on the hidden attribute.  
Screens: [app](diff-shots/DC-01-app.webp) · [prototype](diff-shots/DC-01-proto.webp)

### DC-02 · Native 'Choose File' input at bottom of board  (High)
*Documents · phone 390 — Board*  
Prototype phone board has nothing at the bottom besides the Ask VCFO launcher. App shows a raw 'Choose File  No file chosen' control across the bottom of every phone level (the camera input).  
**Fix:** src/components/client-portal/pages/documents/Mobile.tsx camRef <input type=file hidden>: same [hidden] override; use style={{display:'none'}}.  
Screens: [app](diff-shots/DC-02-app.webp) · [prototype](diff-shots/DC-02-proto.webp)

### DC-03 · All phone ⋮ buttons are invisible  (High)
*Documents · phone 390 — Board ⋮ menus*  
Prototype shows a bordered ⋮ button next to the filter and a ⋮ on every folder/file row. In the app these buttons exist (44px, clickable) but render with opacity 0, so the page menu, folder ZIP and file actions are undiscoverable; the filter also looks oddly short.  
**Fix:** src/components/client-portal/css/documents-boards.css: add opacity:1 to '.cp .cp-documents .vdm .kb' (documents-explorer.css '.cp-documents .kb{opacity:0}' hover-reveal leaks into the phone board).  
Screens: [app](diff-shots/DC-03-app.webp) · [prototype](diff-shots/DC-03-proto.webp)

### DC-04 · Library breaks when Ask VCFO is off  (High)
*Library · desktop — Whole page*  
Prototype shows the bookshelf (or, with no books, the lib_empty board: book illustration, bot bubble, Ask VCFO button, 3 suggested questions). App shows only a red banner 'Could not load your library / Try again' because GET /api/ask/library returns 404 when Ask VCFO is disabled. Cause confirmed: the shelf loads from /api/ask/library, which returns 404 whenever ASK_VCFO_ENABLED is false (the default), so the whole Library page shows an error instead of the bookshelf or its empty state.  
**Fix:** LibraryPage.tsx / library-model.ts: load the shelf from a client-portal route that does not depend on the Ask VCFO flag (or treat 404 as an empty shelf and show the prototype empty state lib_empty.dc.html). src/components/client-portal/pages/documents/library/LibraryPage.tsx: treat a 404 / feature-off AskApiError as the EmptyLibrary state (or hide the Library nav item when ASK_VCFO_ENABLED is off); app/api/ask/library/route.ts requireAsk.  
Screens: [app](diff-shots/DC-04-app.webp) · [prototype](diff-shots/DC-04-proto.webp)

### DC-05 · Phone library also shows only error  (Medium)
*Library · phone 390 — Whole page*  
Prototype phone library shows the empty board (illustration, bubble, Ask VCFO, suggestion chips). App shows only the red 'Could not load your library' banner.  
**Fix:** Same as desktop: LibraryPage.tsx error branch → EmptyLibrary when the Ask API is off.  
Screens: [app](diff-shots/DC-05-app.webp) · [prototype](diff-shots/DC-05-proto.webp)

### DC-06 · Missing rows not under their step  (Medium)
*Documents · desktop — Tree · missing rows*  
Prototype puts each missing (dashed) row inside the step it belongs to (e.g. 'Notarised lease deed' under 8 · Registered Office Address, 'Signed DIR-2' under 6 · Director KYC). App lumps all 4 open requests into a separate 'Other documents › Requested and shared files' folder, even 'Utility bill - office' which is clearly step 8.  
**Fix:** Requests need a step: scripts/seed-demo.ts should set document_request_details.step_id; src/db/repositories/client-documents.ts could fall back to a label→step guess before using 'Other documents'. model.ts buildEntries keeps 'Other documents' only for genuinely step-less files.  
Screens: [app](diff-shots/DC-06-app.webp) · [prototype](diff-shots/DC-06-proto.webp)

### DC-07 · Board resolutions filed under Certificates  (Medium)
*Documents · desktop — By category view*  
Prototype 'By category' puts 'Board resolution (final)' in Company records. App puts 'Signed Board Resolution' and 'Draft Board Resolution' under Certificates because the regex /lut/ matches 'Reso-lut-ion'.  
**Fix:** src/lib/client-portal/documents.ts FIELD_CATEGORY: use word boundaries (\blut\b, \bdin\b, \bnoc\b, \biec\b) and add 'pre-2'/'pre-3' → 'c3' to STEP_CATEGORY.  
Screens: [app](diff-shots/DC-07-app.webp) · [prototype](diff-shots/DC-07-proto.webp)

### DC-08 · 'Other documents' drill says 'in Incorporation'  (Medium)
*Documents · desktop — Progress drill-down*  
Prototype drill banner reads 'These documents are for <step> in <phase>' with a link to that phase. App drill for the 'Requested and shared files' folder says '…in Incorporation' with 'Open Incorporation →', although these files are not in any incorporation step.  
**Fix:** Explorer.tsx where the DrillTarget is built: for the OTHER_PHASE_ID folder set where='Other documents' and drop or relabel the link.  
Screens: [app](diff-shots/DC-08-app.webp) · [prototype](diff-shots/DC-08-proto.webp)

### DC-09 · Phone upload dialog: footer hidden, all requests  (Medium)
*Documents · phone 390 — Missing row tap → upload*  
Prototype phone: a missing row's ⋮ sheet offers Take photo / Choose file / Open step for that one file. App: tapping the row opens the full desktop-style dialog listing all 4 requests; its Cancel/Upload footer sits under the Ask VCFO launcher, and the native file input shows.  
**Fix:** Mobile.tsx row onClick for missing: open the row sheet (items already built at ~line 130) instead of onUpload; UploadDialog.tsx on phone: limit to the tapped request and lift the footer above the launcher (hide launcher while dialog is open).  
Screens: [app](diff-shots/DC-09-app.webp) · [prototype](diff-shots/DC-09-proto.webp)

### DC-10 · Phone rows too tall and over-indented  (Medium)
*Documents · phone 390 — Board rows*  
Prototype rows are about 57px with the folder icon 16px from the card edge. App rows are about 80px with the icon about 32px in, so only 3 rows fill the space the prototype uses for 3 rows plus whitespace, and the list feels sparse.  
**Fix:** src/components/client-portal/css/documents-boards.css '.vdm .row .main': reset the explorer '.main' padding/height inherited from documents-explorer.css; match docs_a_mobile.dc.html row (padding 0 0 0 16px, min-height 56px).  
Screens: [app](diff-shots/DC-10-app.webp) · [prototype](diff-shots/DC-10-proto.webp)

### DC-11 · Reader unreachable: 'explanation not available'  (Low)
*Library reader — Reader page*  
Prototype reader: navy hero with category/Reviewed/Updated chips, depth pill, timeline, Why it matters, sources, actions, and side cards (project, related, documents). App /app/client/learn/<slug> shows only 'This explanation is not available. / Back to library' because every topic in src/data/ask/topics is status 'draft' and Ask is off; there are no saved items either, so no reader link works. Partly data: every topic in the demo database is a draft and the client has no saved items.  
**Fix:** Publish client topics (src/data/ask/topics/*.json status) and/or seed library items; Reader.tsx failed state could reuse the bot-bubble pattern. Re-review the reader once data exists.  
Screens: [app](diff-shots/DC-11-app.webp) · [prototype](diff-shots/DC-11-proto.webp)

### DC-12 · Explorer card doesn't fill viewport height  (Low)
*Documents · desktop — Explorer card*  
Prototype explorer card stretches to the bottom of the viewport (tree scrolls inside; Step/From/Date/File pinned at the bottom of the pane). App card stops at about y=790, leaving an empty band under it, and the pane meta floats mid-screen.  
**Fix:** src/components/client-portal/css/documents-explorer.css: give .vdoc-main a fixed height (calc(100dvh - topbar)) and section flex:1 as in docs_a_refined.dc.html.  
Screens: [app](diff-shots/DC-12-app.webp) · [prototype](diff-shots/DC-12-proto.webp)

### DC-13 · Tree tooltips clipped at column edge  (Low)
*Documents · desktop — Tooltips*  
Prototype progress-bar tooltip wraps to two lines and stays inside the tree ('Director KYC · 4 received · 0 in review · 1 missing'). App tooltip is one line and is cut off at the tree/pane boundary ('Draft Board Resolution · 2 received · 0…'); the 'More actions' tooltip is cut the same way.  
**Fix:** documents-explorer.css .tip::after: allow wrapping (max-width ~260px, white-space normal) and keep overflow visible on .vdoc-tree, or right-align tips near the edge.  
Screens: [app](diff-shots/DC-13-app.webp) · [prototype](diff-shots/DC-13-proto.webp)

### DC-14 · 'Requested' chip instead of due label  (Low)
*Documents · desktop — Missing chips*  
Prototype missing chips always read 'Due 12 Nov' (orange) or 'Overdue' (red), and the pane shows a Due date. App shows 'Requested' and Due '—' because seeded requests have no due date; drill rows then show 'Requested' text next to a 'Missing' badge.  
**Fix:** Mostly seed data (scripts/seed-demo.ts: set dueOn on requests). model.ts missingLabel fallback 'Requested' is fine but consider 'No due date' in the drill date column (Drill.tsx).  
Screens: [app](diff-shots/DC-14-app.webp) · [prototype](diff-shots/DC-14-proto.webp)

### DC-15 · Drill status tabs stretch full width  (Low)
*Documents · desktop — Progress drill-down*  
Prototype drill status pill (All / Received / In review / Missing) is compact (about 340px). App pill stretches the full dialog width.  
**Fix:** Drill.tsx .seg: display inline-grid / width:auto (copy docs_a_drill.dc.html sizing).  
Screens: [app](diff-shots/DC-15-app.webp) · [prototype](diff-shots/DC-15-proto.webp)

### DC-16 · Drill file tags pale, not solid  (Low)
*Documents · desktop — Progress drill-down*  
Prototype drill rows use solid file-type chips (white 'PDF' on red, 'JPG' on teal). App drill uses the pale tree tags.  
**Fix:** Drill.tsx: use the solid tag style from docs_a_drill.dc.html (r.tStyle) instead of model.tagStyle.  
Screens: [app](diff-shots/DC-16-app.webp) · [prototype](diff-shots/DC-16-proto.webp)

### DC-17 · Drill link 'Open step' vs 'Open Incorporation'  (Low)
*Documents · desktop — Progress drill-down*  
Prototype drill banner link reads 'Open Incorporation →' (the phase). App reads 'Open step →'.  
**Fix:** Explorer.tsx DrillTarget.linkText: match prototype wording, or confirm the step deep-link is the intended improvement.  
Screens: [app](diff-shots/DC-17-app.webp) · [prototype](diff-shots/DC-17-proto.webp)

### DC-18 · Month shows 'Sept' instead of 'Sep'  (Low)
*Documents · desktop — Dates*  
Prototype dates use 3-letter months ('14 Sep', '24 Oct 2026'). App uses en-GB toLocaleDateString, which renders 'Sept' ('29 Sept 2026', '25 Sept') in the pane, drill, phone rows and preview sheet.  
**Fix:** src/components/client-portal/pages/documents/file-types.ts longDate/dayMonth: format with a fixed month array (Jan…Dec).  
Screens: [app](diff-shots/DC-18-app.webp) · [prototype](diff-shots/DC-18-proto.webp)

### DC-19 · Extra pale-green status chip in header  (Low)
*Shared document viewer — Viewer header*  
Prototype viewer header: type tag, file name, ⓘ, '1 of 4', Download, close. App adds a pale green 'Final' chip, which also clashes with the navy 'Final' badge used in the explorer pane.  
**Fix:** DocViewer.tsx header chip: drop it, or use STATUS_STYLE colours from model.ts so 'Final' is navy everywhere.  
Screens: [app](diff-shots/DC-19-app.webp) · [prototype](diff-shots/DC-19-proto.webp)

### DC-20 · Phone preview error lacks icon / retry  (Low)
*Documents · phone 390 — Preview sheet*  
Prototype phone preview sheet shows the page with 'Page 1 of 2 · swipe'. When the file fails, the app sheet shows only plain 'Could not open this file' text, without the red icon and 'Try again' button the desktop viewer has.  
**Fix:** src/components/client-portal/pages/documents/MobilePreview.tsx: reuse the DocViewer error block (icon + Try again).  
Screens: [app](diff-shots/DC-20-app.webp) · [prototype](diff-shots/DC-20-proto.webp)

### DC-21 · Root sheet items differ from prototype  (Low)
*Documents · phone 390 — Root ⋮ sheet*  
Prototype root sheet: 'Download folder as ZIP · 13 files' and 'Copy link to folder'. App root sheet: 'Download all (ZIP) · 4 files' and 'Upload · 4 requested' (no copy link).  
**Fix:** Mobile.tsx root items (~line 112): confirm with owner; prototype has no Upload on the phone root and offers Copy link.  
Screens: [app](diff-shots/DC-21-app.webp) · [prototype](diff-shots/DC-21-proto.webp)

### DC-22 · Breadcrumb 'Home / Documents' vs 'Documents'  (Low)
*Documents · desktop — Topbar trail*  
Prototype topbar trail on Documents is the single crumb 'Documents' (folder icon). App shows 'Home / Documents' with a grid icon.  
**Fix:** Shell topbar (src/components/client-portal/ topbar / usePortalCrumbs): drop the Home crumb for top-level pages per docs/topbar.dc.html. Likely shared with other pages.  
Screens: [app](diff-shots/DC-22-app.webp) · [prototype](diff-shots/DC-22-proto.webp)

### DC-23 · Preview pane works (re-checked)  (Info)
*Documents · desktop — Preview pane*  
On first capture the preview pane showed raw JSON because the review's local storage was seeded without the app's bucket prefix. After fixing the seed, the preview renders the PDF and the details table, like the prototype. Not an app difference.  
**Fix:** None (review environment issue).  
Screens: [app](diff-shots/DC-23-app.webp) · [prototype](diff-shots/DC-23-proto.webp)

### DC-24 · Viewer opens files (re-checked)  (Info)
*Shared document viewer — Viewer body*  
The shared viewer opens PDFs with page count, zoom and prev/next once the demo files are stored where the app expects them. Remaining small differences are in the viewer rows below.  
**Fix:** None (review environment issue).  
Screens: [app](diff-shots/DC-24-app.webp) · [prototype](diff-shots/DC-24-proto.webp)

### DC-25 · ZIP download works (re-checked)  (Info)
*Documents · desktop — Download all (ZIP)*  
'Download all (ZIP)' downloads the 4 files and shows the toast once the demo files are stored correctly. Not an app difference.  
**Fix:** None (review environment issue).  
Screens: [app](diff-shots/DC-25-app.webp) · [prototype](diff-shots/DC-25-proto.webp)

### DC-26 · Accepted types / size text differs  (Info)
*Documents · desktop — Upload dialog*  
Prototype: 'PDF · JPG · PNG · DOCX · up to 10 MB'. App: 'PDF · DOCX · JPG · PNG · WEBP · up to 50 MB' (from server config).  
**Fix:** No change if 50 MB/WEBP is the real server limit; app is driven by data.accept.  
Screens: [app](diff-shots/DC-26-app.webp) · [prototype](diff-shots/DC-26-proto.webp)

### DC-27 · Replaced rows not verifiable (no seed)  (Info)
*Documents · desktop — Replaced toggle*  
Prototype 'Replaced' toggle adds italic greyed rows with an eye-off icon and the counter goes 15/17 → 17/17. App toggle highlights but nothing changes because the seed has no replaced versions; code path exists (tr.hid).  
**Fix:** Seed one replaced upload in scripts/seed-demo.ts to verify Explorer.tsx hid rows.  
Screens: [app](diff-shots/DC-27-app.webp) · [prototype](diff-shots/DC-27-proto.webp)

### DC-28 · Bookshelf and recently-read not comparable  (Info)
*Library · desktop — Bookshelf / Recently read*  
Prototype shows category pill, '15 books' chip, Monthly status brief, PDF brief, search, Recently read strip with progress bars (drill-down) and shelves with planks. App has no saved items or reads for either client (and the API is off), so none of this could be checked.  
**Fix:** Seed library items + client_library_reads and enable ASK_VCFO_ENABLED, then re-review LibraryPage.tsx against lib_shelf_a.dc.html / lib_recent_drill.dc.html.  
Screens: [prototype](diff-shots/DC-28-proto.webp)

### DC-29 · Empty and loading states not reachable  (Info)
*Documents · desktop — Empty / loading states*  
Prototype has docs_a_empty and docs_a_loading boards. App seed always has documents and loads fast, so DocsEmpty / DocsLoading (States.tsx) could not be seen.  
**Fix:** Check States.tsx against docs_a_empty.dc.html / docs_a_loading.dc.html with an empty engagement.  
Screens: [prototype](diff-shots/DC-29-proto.webp)

### DC-30 · RUN letter filed under step 2  (Info)
*Documents · desktop — Tree data*  
App shows 'Name approval letter (RUN)' under 2 · Draft Board Resolution; that is how scripts/seed-demo.ts files it (stepId 'pre-2'). App correct for the data; seed is odd.  
**Fix:** Optional: move the seed doc to step 5 (Name Approval) in scripts/seed-demo.ts.  
Screens: [app](diff-shots/DC-30-app.webp)


## Team, updates, settings, credentials

### TM-01 · Native file input shows in hero  (High)
*Settings — Identity hero*  
Prototype hero is avatar + gold camera button + name/email/chips in one tidy row. The app shows a raw browser 'Choose File  No file chosen' control under the avatar, pushes the name block to the far right and clips the company chip ('Northwind Technologies India Pv…').  
**Fix:** SettingsPage.tsx IdentityHero: the <input type=file hidden> is being displayed (a client-portal CSS rule beats the [hidden] attribute). Give it style={{display:'none'}} (or add `.cp [hidden]{display:none!important}` to css/10-base.css). Copy hero layout from settings_redesign.dc.html:90-94.  
Screens: [app](diff-shots/TM-01-app.webp) · [prototype](diff-shots/TM-01-proto.webp)

### TM-02 · Hero overflows and clips on phone  (High)
*Settings · phone 390 — Identity hero*  
On 390 the app hero squeezes the name into 2 lines, wraps the email letter-by-letter and cuts the company chip off the right edge, with the file input still visible. Prototype keeps avatar + name/email/chips on one row inside the card.  
**Fix:** Same fix as the hero file input (SettingsPage.tsx); also add minWidth:0 / overflow-wrap on the text column and let chips wrap.  
Screens: [app](diff-shots/TM-02-app.webp) · [prototype](diff-shots/TM-02-proto.webp)

### TM-03 · Matrix collapses on phone  (High)
*Settings · phone 390 — Notification preference matrix*  
Prototype phone matrix keeps the 'Tell me when' label column wide (labels on 1-2 lines) with Email/WhatsApp toggles right-aligned and no icons. The app squeezes the label column to ~60px so every label breaks word-by-word ('Documents / requested / or / sent / back'), header 'TELL ME WHEN' wraps on 3 lines and the page becomes 2283px tall.  
**Fix:** SettingsPage.tsx matrix + css/team-settings.css: at <=767px use grid `1fr 64px 64px` (hide the 34px icon column) as in settings_redesign.dc.html phone rules (SR:59-75).  
Screens: [app](diff-shots/TM-03-app.webp) · [prototype](diff-shots/TM-03-proto.webp)

### TM-04 · Every item typed as 'Step'  (High)
*Notifications — Row type (icon + chip)*  
Prototype shows '2 documents requested' as Request (blue file icon), 'Passport copy sent back' as Sent back (red chip). The app shows every row, including these two, with the green check icon and 'Step' chip, so Documents/Deadlines/Messages tabs and the donut are all 0.  
**Fix:** NotificationsPage.tsx typeOf(): the notifications table has no kind column so `n.kind` is empty; fall back to title/description text for every kind (sent back/re-upload → back, 'requested' → doc, due/overdue → deadline) or add a kind column in the notifications repository.  
Screens: [app](diff-shots/TM-04-app.webp) · [prototype](diff-shots/TM-04-proto.webp)

### TM-05 · 'Who' missing from rows  (High)
*Notifications — Row who · time column*  
Prototype right column reads 'Arjun Mehta · 10:42' / 'VCFO Suite · 09:00'. The app shows only the date ('Fri 16 Oct'), never who sent it, on desktop, phone and in the drill-down list.  
**Fix:** NotificationsPage.tsx row + Drill: render `${who} · ${x.w}`; needs an actor name on AppNotification (notifications repository / table has no actor column today). Spec NT-05 (who·time 168px).  
Screens: [app](diff-shots/TM-05-app.webp) · [prototype](diff-shots/TM-05-proto.webp)

### TM-06 · Empty bar above dialog footer  (High)
*Team · Invite / Hand-off / Substitute dialogs — Dialog body*  
Prototype dialogs end cleanly after the role strip / checkbox. In the app an empty outlined bar (the hidden submit button) is drawn across the dialog just above the footer in Invite, Hand off your seat, Substitute and Settings 'Turn on WhatsApp'.  
**Fix:** TeamPage.tsx InviteDialog/SubstituteDialog and SettingsPage.tsx WhatsAppDialog render `<button type="submit" hidden />`; a client-portal CSS rule overrides [hidden]. Use style={{display:'none'}} or add `.cp [hidden]{display:none!important}` in css/10-base.css.  
Screens: [app](diff-shots/TM-06-app.webp) · [prototype](diff-shots/TM-06-proto.webp)

### TM-07 · Support card has no person or contact line  (Medium)
*Team — SBC cards · Customer support*  
Prototype support card shows a person name ('Farhat') and 'support@sbc.in · +91 90597 90014' under the chip. The app repeats 'Customer support' as the name (same as the chip) and has no email/phone line, so the card is shorter than the other two.  
**Fix:** TeamPage.tsx SbcCard / shell team builder (usePortal().shell.team): pass the help-desk contact's name, email and phoneE164 into the support entry (TM-04).  
Screens: [app](diff-shots/TM-07-app.webp) · [prototype](diff-shots/TM-07-proto.webp)

### TM-08 · Body has no deep links  (Medium)
*Notifications — Row body line*  
Prototype body line is made of linked parts in primary blue ('Utility bill for the office · Board resolution', 'Open the document', 'GST portal ↗'). The app body is plain grey text with no links.  
**Fix:** NotificationsPage.tsx `.nb`: render body parts with links (NT-05/NT-07); needs link data on the notification (href per part).  
Screens: [app](diff-shots/TM-08-app.webp) · [prototype](diff-shots/TM-08-proto.webp)

### TM-09 · Raw 'Checklist · Save' labels  (Medium)
*Audit — Event action labels*  
Prototype actions are plain words ('Step accepted', 'Document uploaded'). The app shows machine labels 'Checklist · Save' and 'Checklist · Complete' for checklist.save / engagement.checklist.complete events.  
**Fix:** src/db/repositories/client-audit.ts project(): add labels for checklist.save ('Step saved'), *.checklist.complete ('Step accepted'), *.checklist.review ('Step reviewed') instead of formatAuditActionLabel fallback.  
Screens: [app](diff-shots/TM-09-app.webp) · [prototype](diff-shots/TM-09-proto.webp)

### TM-10 · Client tab hidden on phone  (Medium)
*Audit · phone 390 — Who filter pill*  
Prototype phone shows all three who-tabs 'Everyone · SBC · Northwind' in a full-width pill. In the app only 'Everyone' and 'SBC' are visible; the 'Northwind Technologies' tab is pushed off-screen to the right.  
**Fix:** AuditPage.tsx who Seg: use the short company label (first word, as the prototype 'Northwind') and equal 3-column grid; css/team-audit.css phone rule for `.tb-hd` pills.  
Screens: [app](diff-shots/TM-10-app.webp) · [prototype](diff-shots/TM-10-proto.webp)

### TM-11 · Who pill much wider than prototype  (Medium)
*Audit — Who filter pill (desktop)*  
Prototype who-pill is compact (~240px) on the right. The app pill stretches to ~470px with very wide equal columns because the third tab uses the full company name 'Northwind Technologies'.  
**Fix:** AuditPage.tsx line ~251: use companyShort first word (or shell short name) and `grid={false}` sizing like the prototype (AU-04).  
Screens: [app](diff-shots/TM-11-app.webp) · [prototype](diff-shots/TM-11-proto.webp)

### TM-12 · Row eye (preview) icon missing  (Medium)
*Credentials — Sheet rows · # column*  
Prototype rows that hold secret values show an eye (preview row) icon next to the pencil in the # column. The app shows only the pencil on every row of Login Credentials / Directors KYC.  
**Fix:** CredentialsPage.tsx row header (~line 819): render the row-preview eye button for rows with masked columns even when values are empty, as in v7p_credentials.dc.html.  
Screens: [app](diff-shots/TM-12-app.webp) · [prototype](diff-shots/TM-12-proto.webp)

### TM-13 · Portal card very long (49 tasks)  (Medium)
*Announcements — Official portals card*  
Prototype card is compact: Setup 8 (Incorporation, Registrations, FEMA) / Recurring 4. The app lists every portal task (Setup 20 / Recurring 29) with 8 groups, so the card runs ~1300px and dwarfs the Latest list.  
**Fix:** AnnouncementsPage.tsx portals: inventory AN-09 accepts real counts, but cap the visible list (e.g. relevant heads only for this engagement, or max-height with scroll) to keep the compact card the prototype shows.  
Screens: [app](diff-shots/TM-13-app.webp) · [prototype](diff-shots/TM-13-proto.webp)

### TM-14 · No code step in WhatsApp dialog  (Medium)
*Settings — Turn on WhatsApp pop-up*  
Prototype dialog steps are Number → Code → Done with six code boxes and 'Verify & turn on'. The app steps are Number → Consent → Done with no code entry and a plain 'Turn on' button.  
**Fix:** SettingsPage.tsx WhatsAppDialog: documented as not live (no verification template, QUESTIONS.md). Keep tracking; when the template ships, copy the 6-digit field from settings_redesign.dc.html (ST-12).  
Screens: [app](diff-shots/TM-14-app.webp) · [prototype](diff-shots/TM-14-proto.webp)

### TM-15 · From card caption wraps  (Low)
*Team · Hand-off pop-up — From card*  
Prototype 'from' card caption is one line 'Primary · Northwind'. The app uses the full company name so the caption wraps to two lines (three on phone, where the name also splits).  
**Fix:** TeamPage.tsx SubstituteDialog: use the short company name in the caption and ellipsis the line.  
Screens: [app](diff-shots/TM-15-app.webp) · [prototype](diff-shots/TM-15-proto.webp)

### TM-16 · Full company name instead of short  (Low)
*Team / Audit / Settings — Company name in labels*  
Prototype uses the short name everywhere ('People from Northwind', 'Northwind' chip, 'Sees everything on Northwind'). The app uses 'Northwind Technologies' in headings/chips/filters and 'Northwind Technologies India Pvt Ltd' in the Settings chip, causing wraps and clipping.  
**Fix:** shell.companyShort is the full name; derive a short display name (first word, as the prototype) in PortalProvider and use it in TeamPage/AuditPage/SettingsPage.  
Screens: [app](diff-shots/TM-16-app.webp) · [prototype](diff-shots/TM-16-proto.webp)

### TM-17 · Empty today bar drawn navy  (Low)
*Audit — 14-day chart · today bar*  
In the prototype today always has events. In the app today with 0 events is a 3px navy line while other empty days are light grey, which reads like a selected/odd bar.  
**Fix:** AuditPage.tsx bar colour: use var(--border) when count is 0, navy only when today has events.  
Screens: [app](diff-shots/TM-17-app.webp) · [prototype](diff-shots/TM-17-proto.webp)

### TM-18 · Empty bubble style differs  (Low)
*Credentials — Other credentials empty state*  
Prototype empty state is a dark navy one-line pill next to the bot. The app shows a white bordered bubble that wraps to two lines.  
**Fix:** CredentialsPage.tsx empty sheet bubble: copy the navy pill styling from v7p_credentials.dc.html.  
Screens: [app](diff-shots/TM-18-app.webp) · [prototype](diff-shots/TM-18-proto.webp)

### TM-19 · Address band disagrees with Address sheet  (Low)
*Credentials — Login Credentials header band*  
The Login Credentials title band shows 'Address: WeWork Prestige Central, Bengaluru 560001' while the Address sheet's Registered office row is empty. In the prototype both come from the same registered office address.  
**Fix:** CredentialsPage.tsx: build the band from the same registered-office source as the Address sheet (or hide it when empty).  
Screens: [app](diff-shots/TM-19-app.webp) · [prototype](diff-shots/TM-19-proto.webp)

### TM-20 · No empty hint when no directors  (Low)
*Credentials — Directors KYC sheet*  
With no directors yet the app shows only the Particulars column with no explanation. The prototype always has director columns; an empty sheet needs a hint like the other empty sheets.  
**Fix:** CredentialsPage.tsx: when there are 0 director columns, show the bot bubble 'Directors appear here after step 8' with 'Add director'.  
Screens: [app](diff-shots/TM-20-app.webp) · [prototype](diff-shots/TM-20-proto.webp)

### TM-21 · 'Mark all read' on its own row  (Low)
*Notifications · phone 390 — Card header*  
The app adds 'Mark all read' (G1) which on phone drops to a separate row under the pill; the prototype header is just the pill.  
**Fix:** NotificationsPage.tsx .tb-mark: on phone put it as a small link at the right of the group label or inside the pill row.  
Screens: [app](diff-shots/TM-21-app.webp) · [prototype](diff-shots/TM-21-proto.webp)

### TM-22 · Dialog sits higher than spec  (Low)
*Announcements — Detail pop-up position*  
Prototype detail dialog is top-aligned at ~140px from the top. The app opens it at ~108px.  
**Fix:** common.tsx Dialog `top` variant (tb-top --ovt): use min(140px,14vh) per AN-10.  
Screens: [app](diff-shots/TM-22-app.webp) · [prototype](diff-shots/TM-22-proto.webp)

### TM-23 · Greeting bubble covers content  (Low)
*Team / all pages · phone — Ask VCFO greeting*  
On every page the app auto-opens the Ask VCFO greeting bubble, which on 390 covers rows (Team people list, Credentials sheet, Audit last event). The prototype shows only the launcher.  
**Fix:** Shell launcher (src/components/client-portal Visor/launcher): do not auto-open the greeting on inner pages, or only once per session. (Shell area — flag to shell owner.)  
Screens: [app](diff-shots/TM-23-app.webp) · [prototype](diff-shots/TM-23-proto.webp)

### TM-24 · Banner hidden before COI  (Info)
*Announcements — Next-deadline banner*  
Prototype shows 'Next deadline · GSTR-3B' on the before-COI company. The app hides the banner because a pre-incorporation company has no filings yet (G10). App correct; prototype is fake data.  
**Fix:** None.  
Screens: [app](diff-shots/TM-24-app.webp) · [prototype](diff-shots/TM-24-proto.webp)

### TM-25 · No feed items or kind variety  (Info)
*Announcements — Latest list*  
Prototype mixes Deadline/MCA/Compliance/Tax/GST/Post-Incorp kinds and 'Official feed' rows with host chips. App has 2 'General' posts from 'Scratch SBC'. Seed data only; row structure (chip, From…, host chip, unread dot) matches.  
**Fix:** Seed richer announcements to verify feed rows.  
Screens: [app](diff-shots/TM-25-app.webp) · [prototype](diff-shots/TM-25-proto.webp)

### TM-26 · No WhatsApp/Email on author  (Info)
*Announcements · detail — Author strip*  
Prototype author strip has WhatsApp and Email buttons. The app's author is 'Scratch SBC' (not in the SBC team) so no buttons render. Seed data; logic hides them only when no contact.  
**Fix:** None (seed announcements from a real team member to verify).  
Screens: [app](diff-shots/TM-26-app.webp) · [prototype](diff-shots/TM-26-proto.webp)

### TM-27 · Temp password instead of link  (Info)
*Team — Invite pop-up · Sign-in*  
Prototype shows 'Set-password link by email · Expires in 7 days'. App shows 'Temporary password by email' with the password. Matches DECISIONS ('temp password until it ships').  
**Fix:** None until set-password link ships.  
Screens: [app](diff-shots/TM-27-app.webp) · [prototype](diff-shots/TM-27-proto.webp)

### TM-28 · Prototype only toasts on Invite  (Info)
*Team — Invite button*  
In the routed prototype Invite only toasts 'Only the Primary contact can invite'; the app opens the Invite pop-up for the Primary (matches TM-02/TM-14 boards).  
**Fix:** None.  
Screens: [app](diff-shots/TM-28-app.webp) · [prototype](diff-shots/TM-28-proto.webp)

### TM-29 · Two Primary contacts in seed  (Info)
*Team — People list*  
App lists two people both chipped 'Primary' (Northwind Client, Rohan Kumar). Seed data; prototype has one Primary and Members/Invites. Rows render correctly.  
**Fix:** Fix seed (one Primary).  
Screens: [app](diff-shots/TM-29-app.webp) · [prototype](diff-shots/TM-29-proto.webp)

### TM-30 · Auto-filled cells empty  (Info)
*Credentials — Address / mail / mobile cells*  
Prototype fills Address and Login mail/mobile cells with 'Auto · from registered office / client profile'. App cells are '—' because step 7 and the client profile have no data yet. App correct; prototype is fake data.  
**Fix:** None.  
Screens: [app](diff-shots/TM-30-app.webp) · [prototype](diff-shots/TM-30-proto.webp)

### TM-31 · Demo code line only in prototype  (Info)
*Credentials — OTP pop-up*  
Pop-up matches (title, caption, masked manager email, 6 boxes, Resend 0:30, Cancel/Verify). Prototype adds 'Prototype demo code: 123456'. Code request was stubbed during capture — no code sent.  
**Fix:** None.  
Screens: [app](diff-shots/TM-31-app.webp) · [prototype](diff-shots/TM-31-proto.webp)

### TM-32 · Phone, WhatsApp, 'changed' empty  (Info)
*Settings — Profile / Security data*  
Prototype shows phone, verified WhatsApp, 'changed 2 Sep' and 'Chrome on Windows · Hyderabad'. App shows '—', 'Not set up · Off', no changed date, 'Chrome on Linux'. Seed/profile data only; rows and chips render correctly.  
**Fix:** None.  
Screens: [app](diff-shots/TM-32-app.webp) · [prototype](diff-shots/TM-32-proto.webp)


## Shell, Ask VCFO, intro

### SH-01 · Navy blob covers rail icon on hover  (High)
*Tablet · 1024 — Icon rail · tooltips / fly-outs*  
Hovering or opening a rail group in the app paints a second, CSS-only tooltip: a navy box over the icon and a diamond arrow on the tile above, besides the real #vps-tip bubble. Prototype shows only the one tooltip and a clean icon.  
**Fix:** css/10-base.css `.cp [data-tip]:hover::after/::before` leaks into the sidebar. Exclude the shell: e.g. `.cp :not(.vps) > [data-tip]` / add `.cp .vps [data-tip]::before,.cp .vps [data-tip]::after{content:none}` (the rail uses Sidebar.tsx's own .vps-tip like shell.js showTip).  
Screens: [app](diff-shots/SH-01-app.webp) · [prototype](diff-shots/SH-01-proto.webp)

### SH-02 · Stray 'Choose File' input visible  (High)
*Home + Settings · all states — Page content*  
App shows a native 'Choose File / No file chosen' control under the Home content (both before and after COI) and in the Settings profile hero next to the avatar. Prototype has nothing there. Checked all 12 portal pages: only Home and Settings show it.  
**Fix:** Root cause: the reset `.cp :where(...){all:revert}` in css/00-tokens.css (src css-src/00-tokens.css) cancels the `hidden` attribute, so `<input type=file hidden>` (pages/home/ui.tsx:204, pages/team/SettingsPage.tsx:477) renders. Add `.cp [hidden]{display:none!important}` to 00-tokens.css (as was done for .vps-fly[hidden]).  
Screens: [app](diff-shots/SH-02-app.webp)

### SH-03 · 'Choose File' shown inside Settings hero  (High)
*Settings · 1440 — Profile hero*  
The hidden photo-upload input renders as a native file picker overlapping the avatar area of the navy hero. Prototype hero has only the avatar + camera button.  
**Fix:** Same as above: css/00-tokens.css `[hidden]` fix; SettingsPage.tsx:477 input.  
Screens: [app](diff-shots/SH-03-app.webp) · [prototype](diff-shots/SH-03-proto.webp)

### SH-04 · Phone chat is a tall panel, not a bottom sheet  (High)
*Phone · 390 — Ask VCFO chat*  
Prototype phone opens Ask VCFO as a white bottom sheet (grab handle, plain 'Ask VCFO' title + ×, page dimmed above). App opens the desktop window stretched to almost full height with the navy header and peeking robot.  
**Fix:** AskLauncher.tsx: below 768px render the sheet variant (s/home/mobile.html #botBtn sheet, BUILD-INVENTORY L-08/C-12): handle, title row, messages, chips, composer; scrim behind.  
Screens: [app](diff-shots/SH-04-app.webp) · [prototype](diff-shots/SH-04-proto.webp)

### SH-05 · Before/After pill sits before Search  (Medium)
*All pages · 1440 — Top bar · Before/After pill*  
Prototype order is Search ⌘K · Before/After · Announcements · Notifications · Theme (shell.js mountBA inserts the pill right before Announcements). App puts the pill first, left of Search, on every page.  
**Fix:** src/components/client-portal/TopBar.tsx: move the `#vp-ba-top` slot after the `.tbar-srch` button (shell.js mountBA/placeTopSlot; BUILD-INVENTORY B-01/SH-02). Note T-01 in the inventory lists the old order; B-01 and the prototype runtime win.  
Screens: [app](diff-shots/SH-05-app.webp) · [prototype](diff-shots/SH-05-proto.webp)

### SH-06 · Search does not collapse to an icon at 1024  (Medium)
*Tablet · 1024 — Top bar · Search*  
Prototype collapses Search to a 36px icon button at ≤1099/≤1279 px. App keeps the full 'Search ⌘K' box at 1024, crowding the trail.  
**Fix:** TopBar.tsx + css/20-shell.css: add the breakpoint rule hiding `.tbar-sl`/`.kbd` and making `.tbar-srch` 36×36 below 1280px (BUILD-INVENTORY S-01, §1.10; v7x_topbar.dc.html).  
Screens: [app](diff-shots/SH-06-app.webp) · [prototype](diff-shots/SH-06-proto.webp)

### SH-07 · Group icon hidden while fly-out open  (Medium)
*Tablet · 1024 — Icon rail · group fly-out open*  
With the Updates / Compliances fly-out open, the app's rail icon is half covered by the same leaked pseudo-tooltip (dark rounded box). Prototype shows the icon on the light active tile.  
**Fix:** Same fix as above in css/10-base.css (scope the generic [data-tip] pseudo tooltip away from `.vps`).  
Screens: [app](diff-shots/SH-07-app.webp) · [prototype](diff-shots/SH-07-proto.webp)

### SH-08 · Team label wraps: 'Northwind Technologies’s team'  (Medium)
*All pages · 1440 — Sidebar · team label*  
Prototype label is one line 'NORTHWIND’S TEAM' (short name). App uses 'NORTHWIND TECHNOLOGIES’S TEAM', which wraps to two lines and has the wrong possessive after 's'. Same short name feeds the chat header/greeting and account subtitle.  
**Fix:** src/db/repositories/client-portal.ts:184 `shortCompany` only strips 'India Pvt Ltd'; incorporation/data.ts shortCompany() also strips Technologies/Solutions/Services — use one helper for shell.companyShort. In Sidebar.tsx:369 (and AskLauncher) use a possessive helper (name ends in s → ’).  
Screens: [app](diff-shots/SH-08-app.webp) · [prototype](diff-shots/SH-08-proto.webp)

### SH-09 · Phone search: palette under the launcher, not a sheet  (Medium)
*Phone · 390 — Search*  
Prototype phone Search opens a bottom sheet ('Search' title, 44px input 'Search steps, filings, documents', results with icons + subtitles). App shows the desktop palette from the middle of the screen; the Ask VCFO pill, robot and dev badge sit on top of its last rows.  
**Fix:** SearchPalette.tsx: on phone render as a bottom sheet (mobile.html M-25 styling) and raise its z-index above #vp-launch (or add `sheet-open` so the launcher hides, as proto does for sheets).  
Screens: [app](diff-shots/SH-09-app.webp) · [prototype](diff-shots/SH-09-proto.webp)

### SH-10 · Account subtitle cut off mid-word  (Low)
*All pages · 1440 — Sidebar · account row*  
Prototype: 'Northwind · Client' fits. App: 'Northwind Technologies · (' is truncated, losing 'Client'.  
**Fix:** client-portal.ts roleLabel uses the long short-name; fixing companyShort (row above) fixes it. Sidebar.tsx account `.vps-nm small` keeps ellipsis.  
Screens: [app](diff-shots/SH-10-app.webp) · [prototype](diff-shots/SH-10-proto.webp)

### SH-11 · Chat subtitle wraps to two lines  (Low)
*Ask VCFO chat · 1440 — Chat header + greeting*  
Prototype header subtitle 'Answers from Northwind’s project data' is one line. App 'Answers from Northwind Technologies’s project data' wraps and makes the navy header taller; greeting also says 'Northwind Technologies’s'.  
**Fix:** AskLauncher.tsx header/greeting use shell.companyShort — fixed by the companyShort/possessive fix.  
Screens: [app](diff-shots/SH-11-app.webp) · [prototype](diff-shots/SH-11-proto.webp)

### SH-12 · Phone top bar icons smaller/greyer  (Low)
*Phone · 390 — Top bar*  
Prototype: 56px bar, 20px dark search icon, bell in primary blue, 'Home' 800 weight navy. App: shorter bar, 14px blue search icon, grey bell, lighter title.  
**Fix:** TopBar.tsx + css/20-shell.css phone rules: search icon 20px muted colour, 44px buttons, bell `color:var(--primary)` when unread, title 800 15px (BUILD-INVENTORY M-01).  
Screens: [app](diff-shots/SH-12-app.webp) · [prototype](diff-shots/SH-12-proto.webp)

### SH-13 · Bell not tinted when there are unread  (Low)
*Home / Documents / Library / Incorporation · 1440 — Top bar · Notifications*  
Prototype tints the Notifications button primary-light with a blue bell whenever there are unread notifications. App tints it only on the Notifications page; otherwise a grey bell.  
**Fix:** TopBar.tsx: use the `on` style when `notif > 0` (v7x_topbar.dc.html 'Notifications, 3 new' button; SH-02 'tinted primary-light').  
Screens: [app](diff-shots/SH-13-app.webp) · [prototype](diff-shots/SH-13-proto.webp)

### SH-14 · Trail icon always the Home grid  (Low)
*Documents / Library / Credentials / Compliances · 1440 — Top bar · location trail*  
Prototype trail tile uses the page's own icon (folder for Documents/Library, key for Credentials, shield for Compliances) and shows just the page name. App always shows the Home grid icon and 'Home / <page>'.  
**Fix:** TopBar.tsx `.tbar-ic`: pick the icon from routes.ts per active key (icons.tsx docs/lib/key/comp) as in each board's topbar trail; drop the 'Home /' prefix where the prototype has none.  
Screens: [app](diff-shots/SH-14-app.webp) · [prototype](diff-shots/SH-14-proto.webp)

### SH-15 · Step crumb leaf has 'Step 7 ·' prefix  (Low)
*Incorporation step page · 1440 — Top bar · location trail*  
Prototype leaf is 'Registered Office Address'. App leaf is 'Step 7 · Registered Office Address', making the trail longer.  
**Fix:** TopBar.tsx crumbs from PortalProvider (`crumbs`) set by StepPage.tsx: pass the bare step title as the last crumb.  
Screens: [app](diff-shots/SH-15-app.webp) · [prototype](diff-shots/SH-15-proto.webp)

### SH-16 · Theme tooltip runs off the right edge  (Low)
*All pages · 1440 — Top bar · Theme tooltip*  
Prototype clamps tooltips 8px inside the viewport. App's 'Switch to dark theme' tooltip is centred under the button and is cut off at the right edge ('Switch to dark th').  
**Fix:** TopBar.tsx theme button uses the CSS pseudo tooltip (css/10-base.css [data-tip]); route it through IconTips/#vp-tip with edge clamping (proto.js tooltip, BUILD-INVENTORY N-03).  
Screens: [app](diff-shots/SH-16-app.webp) · [prototype](diff-shots/SH-16-proto.webp)

### SH-17 · Dashboard flashes before the intro  (Low)
*First load · 1440 — Intro animation*  
Prototype intro starts on a white screen at load. App paints the dashboard first and mounts the intro ~0.4s later (after shell + prefs fetch), so the page flashes, then the white intro covers it. Intro frames themselves (three cards → VCFO Suite by SBC, Skip) match.  
**Fix:** PortalIntro.tsx: render a white cover immediately while `prefs` is loading when intro may play (e.g. server-render intro_seen flag in the layout, or hide `.cp-body` until prefs resolve).  
Screens: [app](diff-shots/SH-17-app.webp) · [prototype](diff-shots/SH-17-proto.webp)

### SH-18 · Robot hidden at rest on Home  (Info)
*Home · 1440 — Ask VCFO avatar*  
Prototype robot stands left of the Ask VCFO pill on Home. In the app it stays ducked because it would cover the eye/download icons of the Recent documents rows (which sit higher in the app's layout). This is the spec'd 'covers a control' rule.  
**Fix:** No shell change; follows from the Home layout (home group). AskLauncher.tsx coversControl matches proto.js.  
Screens: [app](diff-shots/SH-18-app.webp) · [prototype](diff-shots/SH-18-proto.webp)

### SH-19 · First-visit note shown (not in prototype runtime)  (Info)
*Home · 1440 — Ask VCFO first-visit note*  
App shows the 'Hello. Ask me anything…' card with two chips above the launcher on first visit. The FINAL prototype doesn't render it, but DECISIONS.md ('First-visit bot note: once per client') and board v7chat_launcher ask for it.  
**Fix:** App correct per DECISIONS.md; prototype runtime omits it.  
Screens: [app](diff-shots/SH-19-app.webp) · [prototype](diff-shots/SH-19-proto.webp)

### SH-20 · Real command palette vs prototype toast  (Info)
*All pages · 1440 — Search ⌘K*  
Prototype Search only focuses the box (a toast in some boards); ⌘K does nothing. App opens a working palette (Pages + Documents, ↑↓ / Enter / Esc). The inventory (S-02) asks for the real palette.  
**Fix:** App correct; prototype is visual only.  
Screens: [app](diff-shots/SH-20-app.webp) · [prototype](diff-shots/SH-20-proto.webp)

### SH-21 · App answers add Helpful? 👍/👎  (Info)
*Ask VCFO chat · 1440 — Answer bubble*  
App answers show 'Helpful?' thumbs buttons; prototype answer bubble has none. DECISIONS.md keeps 👍/👎. The app's 'next step' answer is also shorter (no upload list or other steps in progress).  
**Fix:** App correct for thumbs. Optional: enrich lib/client-portal/answers.ts 'next step' text with needed items like the prototype QA.  
Screens: [app](diff-shots/SH-21-app.webp) · [prototype](diff-shots/SH-21-proto.webp)

### SH-22 · Next.js dev badge covers the avatar  (Info)
*All pages · dev only — Account row*  
In the app the Next.js dev-tools 'N' button sits over the account avatar (bottom-left) on every page and on phones over content. Not in the prototype; dev build only.  
**Fix:** Dev only; optional `devIndicators: false` in next.config to keep screenshots clean.  
Screens: [app](diff-shots/SH-22-app.webp) · [prototype](diff-shots/SH-22-proto.webp)

### SH-23 · Drawer group open state remembered across devices  (Info)
*Phone · 390 — Drawer*  
Prototype drawer starts with Updates/Compliances closed (per-browser). App remembers open groups server-side (client_portal_prefs.nav_open), so groups opened on desktop are open in the phone drawer too. Otherwise the drawer (Before/After at top, nav, team rows with 4 action buttons, account row) matches.  
**Fix:** Intended (prefs are DB-backed); no change.  
Screens: [app](diff-shots/SH-23-app.webp) · [prototype](diff-shots/SH-23-proto.webp)

### SH-24 · Skeleton shows while next page loads  (Info)
*Page change · 1440 — Page-enter*  
Prototype screens appear fully drawn. App shows grey skeleton blocks for ~0.5s (Library) while data loads, then content fades in. Expected for live data.  
**Fix:** No change needed.  
Screens: [app](diff-shots/SH-24-app.webp) · [prototype](diff-shots/SH-24-proto.webp)

### SH-25 · Prototype boards differ in icon details  (Info)
*Several pages · 1440 — Top bar · Announcements / Theme icons*  
Some prototype boards draw an outline megaphone without the gold unread dot and a moon theme icon (Incorporation, Credentials); Home/Team boards use the gold-dot megaphone and sun like the app.  
**Fix:** App consistent; prototype boards inconsistent.  
Screens: [app](diff-shots/SH-25-app.webp) · [prototype](diff-shots/SH-25-proto.webp)
