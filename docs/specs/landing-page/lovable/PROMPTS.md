# Lovable prompts: cards and dashboards

This is the brief pack for the Lovable round that polishes the old prototype's cards and dashboards. Budget: about 40 of the 180 credits, with about 30 more held for the owner's review round. The rest stays unspent. Scope: the shell, three dashboards and one cards sheet. Tables, record pages, calendar, step pages and the landing page are out.

The pack:

- `KNOWLEDGE.md`: paste into the Lovable project under Settings → Knowledge before the first prompt. It goes with every prompt at no cost.
- `refs/old/*.png`: the old screens at 1440 px (`*-1440.png`, full height; `*-fold.png`, the first 900 px) and at 390 px. Attach them to the prompts as images.
- `refs/look/*.png`: Karbon, TaxDome and Mercury captures. Attach as the model for finish only, never for layout.
- `data/*.json`: every label, number, name and date on each dashboard, card by card. Lovable must use these word for word.
- The `*.txt` files are raw text dumps for the port step, not for Lovable.

## Credit rules

1. Knowledge file first. Keep it short, because it goes with every prompt.
2. One Plan-mode check, then build. No chat threads.
3. One dashboard per prompt, with its screenshot and its data attached, and the line "Change only the finish. Keep every part in place."
4. At most one refine per prompt. After that use Visual Edits (free, no prompt) for spacing and colour nudges, or fix the code locally and push through GitHub (free).
5. Never ask Lovable to fix the same error twice. Fix it locally.
6. After the first three prompts, open the ⋯ menu on each message, read its cost, and fill the ledger. If a build prompt costs more than 3 credits, switch to the pre-bake variant at the end of this file.
7. Dark mode and 390 px once each, across all screens, after the light desktop screens are approved.
8. Stop at the reserve line. Log the running total after every prompt.

## Ledger

| # | Prompt | Cap | Spent | Running total |
|---|---|---|---|---|
| P0 | Knowledge file, GitHub connect, push the pack | 0 | | |
| P1 | Plan-mode check | 1 | | |
| P2 | Shell, tokens, Lead Today | 4 | | |
| P3 | Lead Today refine | 2 | | |
| P4 | Client Home | 4 | | |
| P5 | Client Home refine | 2 | | |
| P6 | Super admin Overview | 4 | | |
| P7 | Super admin Overview refine | 2 | | |
| P8 | Cards sheet | 3 | | |
| P9 | Dark mode, all screens | 3 | | |
| P10 | 390 px, all screens | 3 | | |
| P11 | Admin Today (only if the total is under 25) | 4 | | |
| | Reserve for the owner's review round | 30 | | |

## P0: set up (0 credits)

1. Create a blank Lovable project. Name it "VCFO cards and dashboards".
2. Settings → Knowledge: paste the whole of `KNOWLEDGE.md`.
3. Settings → GitHub: connect and create the repository. Clone it locally.
4. Copy this folder's `data/` and `refs/` into the repository as `brief/data/` and `brief/refs/`. Commit and push to `main`. Lovable syncs the files and can read them by path. This costs nothing.

## P1: Plan-mode check (cap 1)

Switch the prompt box to Plan (chat) mode and send:

> Read the project knowledge and the files under brief/. Reply with three lists and nothing else: the CSS variables you will put in src/index.css; the components you will build (shell, greeting card, number strip, section card, attention list, activity list, progress list, phase rows, stacked bar, tile grid, key-value, document list, Gantt rows, e-Filing grid, chip, button, tabs, date tile, icon tile); and any rule in the knowledge you cannot follow. Do not build anything yet.

Accept when: the variable list matches the token table, every component is named once, and the third list is empty. If something is off, fix the wording in the Knowledge file rather than replying in chat.

## P2: shell, tokens and Lead Today (cap 4)

Attach: `refs/old/lead-today-1440.png`, `refs/old/lead-today-390.png`, `refs/look/karbon.png`, `refs/look/mercury.png`. Build mode. Send:

> Build the shell and the Lead · Today dashboard at /lead/today from brief/data/lead-today.json and the attached screenshot.
>
> Shell: a fixed 236 px navy sidebar with the items, counts, client list, the October month calendar with its due days, "Your managers" and the signed-in person from the data file, an icon on every item. A 60 px top bar with the SBC crumb, search, bell, theme toggle and an "Ask VCFO" text button.
>
> Dashboard, in this order: the greeting card (navy band with the date, the name and the All / Incorporating / Compliance tabs, then the white number strip with a tinted icon tile per number), the second strip, then the cards exactly where the screenshot has them: Action queue, Phase progress and Clients × filings on the left; Inbox and Waiting on client on the right.
>
> Use the text, numbers, names and dates in the data file word for word. Leave out the parts the data file lists under "excluded".
>
> Change only the finish. Keep every part in place. Follow the knowledge rules for cards, chips, buttons, tabs, lines, type and spacing. The two look references show the level of finish, not the layout. Light mode, desktop first.

Accept when: every card and every row from the data file is there; no new parts; the greeting card and number strip match the rule; no gradients, shadows or coloured left edges; sentence case; chips are 22 px soft tints with a dot; one main button per card; the sidebar has icons; no hex value outside `src/index.css`.

## P3: Lead Today refine (cap 2)

Review against `refs/old/lead-today-1440.png` and the acceptance list. List only the misses, numbered, and send:

> Fix only these on /lead/today, nothing else: 1. … 2. … 3. …

Spacing and colour nudges go through Visual Edits instead. A wrong hex or size is fixed locally and pushed.

## P4: Client Home (cap 4)

Attach: `refs/old/client-home-1440.png`, `refs/old/client-home-390.png`, `refs/look/taxdome.png`. Send:

> Build the Client · Home dashboard at /client/home from brief/data/client-home.json and the attached screenshot, with the same shell and components as /lead/today. The sidebar is the client one from the data file, with "Northwind's team" at the bottom. The top bar has the Before / After switch.
>
> Order: the greeting card (navy band with the date, the company name and the Report button, then the number strip), the Timeline card full width (a Gantt as the data file describes, with the orange today line and the orange COI diamond), the Steps card full width (phase rows with plain chevrons, Phase 2 expanded as an e-Filing grid), then Needs from Northwind, Recent documents and Recent activity on the left, Important alerts and What SBC is doing on the right.
>
> Leave out the "Your next action" bar and the other parts listed under "excluded". The urgent alert row is tinted soft red with no coloured left edge. File badges are coloured by type.
>
> Use the data file word for word. Change only the finish. Keep every part in place.

Accept when: all nine cards are there with every row; the Gantt reads as the rule says; Phase 2 is an e-Filing grid; the alerts row has no left edge; the Before / After switch is in the top bar; nothing invented.

## P5: Client Home refine (cap 2)

Same pattern as P3.

## P6: Super admin Overview (cap 4)

Attach: `refs/old/super-overview-1440.png`, `refs/look/mercury.png`. Send:

> Build the Super admin · Overview dashboard at /super/overview from brief/data/super-overview.json and the attached screenshot, with the same shell and components. The sidebar is the super admin one from the data file.
>
> Order: the greeting card (the number strip has four numbers, each with a small muted delta), then Incorporation, Registrations and Compliances · October in one row, then Admins · this month and Managers in one row as e-Filing grids, then Top risks full width.
>
> The Compliances card shows its split as one stacked bar with a legend, not a donut. Leave out the parts listed under "excluded".
>
> Use the data file word for word. Change only the finish. Keep every part in place.

Accept when: the four numbers carry their deltas; the three practice cards share one head style; the two grids have navy heads, grid lines, zebra rows; the split is a stacked bar; Top risks rows have the initials tile, the meta line and the soft chip.

## P7: Super admin Overview refine (cap 2)

Same pattern as P3.

## P8: cards sheet (cap 3)

Attach nothing new. Send:

> Add a /cards page that shows every component used on the three dashboards, each in every state, with real text from the data files: greeting card and number strip (with and without deltas), section card head with its icon tile, attention list (urgent, due soon, upcoming), activity list, progress list, phase rows (collapsed and expanded), stacked bar with legend, tile grid of numbers, key-value facts, document list with every file badge, Gantt rows (done, current, planned, milestone), e-Filing grid with head-bar filters and page numbers, chips (every tone, table width and owner width), buttons (main, secondary, small, disabled), tabs (picked and quiet), date tiles (every urgency), icon tiles (every tone), an empty row. Group them under sentence-case headings. Reuse the existing components; add no new styles.

Accept when: every item is there, nothing is restyled, and the page uses only existing components.

## P9: dark mode (cap 3)

> Add dark mode to every screen with the dark column of the token table: slate surfaces, never black. Chips and tiles mix their colour with the surface at 16 percent. The main button lifts to the dark --btn value. The toggle in the top bar switches it and remembers the choice. Change nothing else.

Check all four pages in dark mode against the rule. Contrast must hold on chips, tiles and grid heads.

## P10: 390 px (cap 3)

Attach: `refs/old/lead-today-390.png`, `refs/old/client-home-390.png`. Send:

> Make every screen work at 390 px as the two attached screenshots show: the sidebar folds behind a menu button in the top bar, the number strip wraps to two columns, cards stack in one column in the same order, grids and the Gantt scroll sideways inside their card. Change nothing on desktop.

## P11: Admin Today (cap 4, only if the running total is under 25)

Attach: `refs/old/admin-today-1440.png`. Send:

> Build the Admin · Today dashboard at /admin/today from brief/data/admin-today.json and the attached screenshot, with the same shell and components. The sidebar is the admin one. Order: the greeting card with six numbers, the three practice cards, Clients · where each one is as an e-Filing grid with its two dropdown filters in the head bar, Phase progress with its solid phase cells, then Managers as an e-Filing grid and Needs your decision side by side. Use the data file word for word. Change only the finish. Keep every part in place.

## After Lovable: the port

Pull the repository. The diff of Lovable's commits is the finish spec: `src/index.css` holds the tokens, the components hold the Tailwind classes. Port it into `../src/proto-fix/ds.css` (v2) and new sections in `../src/proto-fix/patch.mjs`, rebuild with the two commands in the landing-page README, and compare the rebuilt dashboards with Lovable's render side by side. Log each change as a CHANGES row that names the real-tool file.

## Pre-bake variant

Use it if a build prompt costs more than 3 credits. Build the remaining dashboards locally in the Lovable repository (shadcn plus the tokens, faithful to the old screenshots and data files), push, and ask Lovable only: "Polish /super/overview to the finish of /lead/today. Change only spacing, alignment, type, lines and states." That is about 1 credit per screen and keeps the data honest.

## Change of course (28 Oct 2026)

The first build copied the old prototype, because the first instructions told Lovable to polish and not redesign. The owner wants new, creative UI and new card ideas. `KNOWLEDGE.md` is now a creative brief: the content and the real data stay, the look and the cards are Lovable's to invent, within the brand (navy, logo orange, status colours, real logos) and the taste rules (no gradients, colour only for meaning, no mascot). The prompts in `attach/` follow it: P3 asks for three new directions of Lead · Today at /lead/today/a, /b and /c; after the owner picks one, P4, P6 and P11 design the other dashboards in that direction. The sections above that say "change only the finish" no longer apply.

Without GitHub: each `attach/` folder holds the images to drag in and a `PROMPT.txt` to paste. Code comes back to Claude through the published `lovable.app` URL or the code view.
