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
