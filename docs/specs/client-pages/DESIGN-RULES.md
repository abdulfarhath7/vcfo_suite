# Client pages: shared design rules

Owner direction, 2026-10-08. These rules apply to every client page redesign. The client home (dashboard v7.4) is the source of truth for the look.

| Source | Link |
|---|---|
| Dashboard canvas (v7.4) | https://claude.ai/artifact/V5wFoBBsQ3E2FFebgQ4rvW |
| Design system | https://claude.ai/artifact/BF9VZyghEDDv9dfKW8GVbF |
| Owner brief | `docs/specs/client-dashboard/BRIEF.md` |
| Bot avatar | `docs/specs/client-dashboard/assets/` |

## Process for each page

1. **Current page first.** Recreate the page as it is in the running app, from the real code (`app/app/client/**/page.tsx`, `src/views/client/*`, `src/components/**`), with realistic demo data. Use the artboard title "Current". If you can run the app and take a screenshot, do so; otherwise rebuild it from the code.
2. **Redesign.** One "Redesign" artboard in the v7.4 style. Add extra artboards for pop-ups, empty states and key interactions.
3. The owner approves. Then a prototype is made, and then the build.

## Rules

| # | Rule |
|---|---|
| 1 | Improve the existing app. Keep the routes, data and features. Don't invent a new app. |
| 2 | Same shell as the dashboard v7.4: dark navy sidebar (with Your team + Customer support rows and an account row at the bottom), and a top bar with logo · location trail · Search ⌘K on the right · Announcements · Notifications · Theme. **No profile in the top bar. No Ask VCFO button in the top bar.** |
| 3 | Ask VCFO robot launcher at the bottom right. It pops up from the bottom edge of the screen, as on the dashboard. |
| 4 | Colours: navy `--navy` #0f2a4a (greeting card, sidebar, active pills), `--navy-3` #1b4f94 for dark mode, gold accents. Each colour has one meaning: green done, amber due soon, red overdue, blue info, violet knowledge. Bold, visual, high contrast. |
| 5 | Sliding selectors: the VCFO Suite sliding pill with spring motion. The **active pill is navy** with a white label, on a light-grey track. |
| 6 | Corners: buttons 6 px, badges 4 px, cards ≤ 12 px. No fully rounded buttons. |
| 7 | **No explanation text on the page.** No grey helper lines under titles. Put an (i) button next to the title instead; click it to open a small pop-over attached to the icon (≤ 280 px). The pop-over ends with a "🤖 Ask VCFO about this" row. |
| 8 | No useless repeats (for example "Not uploaded" under a "Missing" badge). |
| 9 | Documents: click a row → preview overlay. Row actions: 👁 Preview · ⬇ Download icon buttons. |
| 10 | Diagrams and timelines: connected chips (done green ✓ · current navy with a gold pulse · next dashed), one short line per node. |
| 11 | Visuals over text: donuts, coloured bars, filled icon circles, date tiles, coloured status chips. Keep text short. |
| 12 | Motion: count-up numbers, current-step pulse, toast + Undo, skeleton loaders, friendly empty states. Respect `prefers-reduced-motion`. |
| 13 | Pages, not pop-ups, for navigation. Pop-ups are allowed only for details (step details, previews, (i), drill-downs). |
| 14 | **Every visual can be explored.** Every chart, ring, donut, bar, progress bar, flow chart and timeline works like the dashboard donut: **hover** a part → a small tooltip names it and gives its count or date; **click** a part → a pop-up lists exactly the items behind it, with a navy sliding pill to switch between the parts and the clicked part pre-selected. Each list row opens its real page. On touch screens, tap = click. Use the same tooltip and pop-up component everywhere. |
| 15 | **Portal links ↗ and proofs 📎.** Every compliance, registration, company ID and government filing gets a small ↗ icon button (16 px, muted, navy on hover, tooltip "Open GST portal") after its name. It opens the official portal in a new tab, deep-linked where possible. Filed items get a 📎 Proof chip that opens the proof (acknowledgement, challan, certificate) in the shared preview. A filed item with no proof shows an amber "Proof pending" chip. Items not yet filed show ↗ only. Portals: GST, Income-tax/TRACES, MCA, EPFO, ESIC, state PT / Shops & Establishment, RBI FIRMS, DGFT, Udyam, IP India, STPI. |
| 16 | **The bot speaks.** Wherever the page must tell the client something (empty states such as "No FEMA deadlines in May", notices, first-time tips, "nothing to do" states), the Ask VCFO robot avatar says it in a small speech bubble (avatar 40–56 px + bubble with 1–2 short lines + an optional action button such as "Ask VCFO why"). Use the same component everywhere. Errors and warnings keep their own red/amber style; the bot is for friendly guidance only. |
