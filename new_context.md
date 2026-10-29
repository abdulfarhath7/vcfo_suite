# VCFO Suite: UI port tonight (context for terminal Claude)

You work alone tonight. The owner is asleep for about 5 hours. Do not stop to ask questions. When something is unclear, choose the safer option, write it down in `docs/ui-port/DECISIONS.md`, and keep going.

## 1. The goal (owner's words, summarised)

VCFO Suite is the real application: front end, back end, database, auth, every working feature. Its weak point is the UI.
A separate clickable prototype now holds the UI the owner wants.

At the end:
- VCFO Suite **looks exactly like the prototype**.
- VCFO Suite **keeps every feature it already has**, including features the prototype never shows. Those get restyled in the same design.
- VCFO Suite **gains the features the prototype added**, built for real, with real data.

Never remove working functionality to match a screen. Never fake data to match a screen.

## 2. Where things are

| What | Where |
|---|---|
| VCFO Suite (you work here) | `~/Documents/vcfo-suite` (this repo) |
| Prototype (read only, never edit) | GitHub `abdulfarhath7/vcfo-prototype`. Clone it next to this repo, for example `~/Documents/vcfo-prototype-ref`. |
| Prototype branch with the new design | `design/spectrum`. It is still being finished tonight by another Claude. `main` has the older design. |
| Prototype → real tool map | `docs/REAL-TOOL-MAP.md` in the prototype. It names the real-tool file for every prototype screen and card. Start from it. |
| Design rules (the authority) | `docs/RULES.md` on the prototype's `design/spectrum` branch. Where this file and that file disagree, `RULES.md` wins. |
| Screens list | `docs/SCREENS.md`, `docs/CHANGES.md`, `CONTEXT.md` in the prototype |
| Old prototype (landing page source) | `reference/vcfo-suite-v6.html` in the prototype |

The design canvases live on the owner's other Claude account. You cannot open them. Everything you need is in the prototype repo and in section 5 below.

## 3. Safety rules (hard)

1. Work on a new branch: `ui/spectrum`, made from this repo's main branch. Never commit to main. Never merge.
2. Never deploy. Never push to a production remote other than the `ui/spectrum` branch.
3. Never run migrations, seeds or destructive SQL against a shared, staging or production database. Use only a local dev database. If there is no local one, do not touch the database. Write the needed migration as a file and list it in the report.
4. Never commit secrets, `.env` files or keys. Never print them.
5. Never delete a feature, route, API, test or permission check. Moving or restyling is fine.
6. No force push. No history rewrite.
7. Commit after every finished unit (tokens, shell, each component group, each portal). Push the branch after each commit if a remote exists.
8. Run the repo's own checks (typecheck, lint, tests) before each commit. Keep them green. If a test fails because markup changed, update the test to the new markup, never delete it.

## 4. The order of work

### Phase 1: Audit (about 45 min). Do this first, it does not depend on the unfinished design.
1. Read this repo: stack, routes, portals (client, project lead, manager, admin, super admin, developer), data layer, auth, styling system.
2. Clone the prototype. Read `CONTEXT.md`, `docs/RULES.md` (on `design/spectrum`), `docs/SCREENS.md` and `docs/REAL-TOOL-MAP.md`.
3. Write `docs/ui-port/AUDIT.md`: one table row per screen or feature.
   Columns: Portal · Screen/feature · In VCFO Suite (file) · In prototype (file) · Action.
   Actions: **Restyle** (both have it), **Keep + restyle** (Suite only), **Build** (prototype only, backend exists or is small), **Gap** (prototype only, needs real backend work; list what is needed).

### Phase 2: Foundation (about 60–90 min)
Port in this order, matching the prototype's `design/spectrum` branch:
1. Design tokens: colours, light and dark, radius, borders, shadows, sizes. Copy from the prototype's `src/styles/tokens.css` and `tailwind.config.ts`. Adapt to this repo's styling system.
2. Fonts: Roboto 400/500/700 for the app; Roboto Mono 500 for identifiers.
3. App shell: navy sidebar, top bar with Ctrl K search, bell, theme switch; the 3 px regulator ribbon.
4. Shared UI parts: buttons, status chip, area pill, owner chip, inputs, switch, checkbox, tabs, segmented switch, tables, number tiles, home card, steps (ST5), Gantt, charts, menus, tooltips, toasts, dialogs, empty, loading, upload.
   Make one component per part, used everywhere.

If `design/spectrum` does not exist yet or has no tokens commit, use section 5. Every 30 minutes, run `git fetch` on the prototype and pull the latest `design/spectrum`.

### Phase 3: Screens, portal by portal
Order: client → manager → project lead → admin → super admin → developer → public pages (landing, sign in).
For each screen:
- Keep the real data, API calls, permissions and actions. Replace only the layout and look with the prototype's.
- Match the prototype screen 1:1: same cards, order, words, empty states.
- Suite-only features: restyle them with the same components and place them where they fit the prototype's layout.
- Prototype-only features: build them if the backend supports it. If not, add a row to `docs/ui-port/GAPS.md`. Do not show fake numbers.
- Check the screen in light, dark and at 390 px width before you commit.

The landing page follows the prototype's `design/spectrum` landing. That is the old v6 landing restored, with a new "VCFO way vs the old way" comparison table. It keeps its own dark navy look (Public Sans, blue #6AA2E8, orange #F2A35B).

### Phase 4: Report (last 20 min, even if not finished)
Write `docs/ui-port/REPORT.md` for the owner:
- Done: a table of portals and screens, with status.
- Not done: what is left and the next step.
- Gaps: features that need backend work.
- Decisions you made alone.
- How to run it and see it.
Commit and push. Stop cleanly before your usage runs out; a clean half is better than a broken whole.

## 5. Design summary (use only if the prototype branch is not ready)

- **Font:** Roboto; Roboto Mono only for CIN, PAN, GSTIN, DIN, SRN, step codes (Pre-7), form codes (GSTR-3B). Tabular numbers.
- **Light:**
  - Canvas #F6F8FB, panel #FFFFFF, line #E3E8EF, control edge #CBD3DE.
  - Ink #0A2540 / #3C4F69 / #5E6E85.
  - Primary #635BFF (hover #5249F0, soft #EFEEFF, text #4A3FE0).
  - Navy #0A2540. Brand orange #F26B1D (logo and "today" line only). Danger #D92D20.
- **Dark:**
  - Canvas #0B0C10, panel #13151A, line #242830.
  - Ink #F2F4F8 / #B6BECA / #8E97A5.
  - Primary #7A72FF. Sidebar #0B1424.
- **Status, light (text / fill / dot):**
  - Done #0B7A43 / #DFF5E7 / #16A34A
  - In progress #4A3FE0 / #EFEEFF / #635BFF
  - Waiting #06708C / #DFF3F9 / #0EA5C6
  - Due soon #9A4D00 / #FFF0D9 / #F59E0B
  - Overdue #C0182F / #FFE6E9 / #E11D48
  - Not started #4E5D73 / #EDF0F5 / #94A3B8
- **Regulators:** MCA #2F6FEB, GST #0E9F8E, Income tax #8B5CF6, Payroll #F29D12, FEMA #E8457A, Labour #6BA815.
- **Shape:**
  - One radius, 6 px, on everything. 4 px on marks under 24 px. 3 px on bars.
  - People avatars are circles. Companies are 6 px squares.
  - Cards and controls have a 1.5 px edge. Shadows only on things that float (menus, tooltips, toasts, dialogs).
- **Chips:** status chip 24 px, fixed 104 px wide, square dot + one of six words: Not started, In progress, Waiting, Due soon, Overdue, Done. Area pill 104 px, white with an 8 px colour swatch.
- **Sidebar:** navy, 34 px rows. Active row tinted blurple (rgba(122,114,255,.26)) with #D9D6FF text. "Ask VCFO" is a button at its bottom, never a floating bubble.
- **Buttons:** primary blurple with a faint top shine, 36 px (small 30, large 42). Secondary is white with a 1.5 px edge. Ghost is a light fill. Icon buttons are 6 px squares.
- **Home card (every portal home):** one card holds the date, the greeting (staff) or company name (client), the actions and 5 number tiles. It sits on a deep colour-wash gradient. The tiles are white, 90% opacity, floating.
- **Tables:** clean rows, uppercase 11.5 px header, 44 px rows, no column lines, no zebra.
- **Steps (ST5):** a 4-phase track (Name application 5, Incorporation 9, Post-incorporation 11, Registrations 23 steps), then the current phase's step list with who holds each step.
- **Writing:** no "Your next action" or notification bars on pages (they go to the bell). No mascots. No helper sentences under buttons. Sentence case. Plain dates ("14 Oct").

## 6. How to behave

- Do not ask the owner anything tonight. Decide, note it in `DECISIONS.md`, move on.
- If you are blocked on one screen, write it in the report and go to the next.
- Prefer finishing whole portals well over touching every screen badly.
- Use sub-agents for parallel screen work if your tools allow it, but you review and commit their work yourself.
