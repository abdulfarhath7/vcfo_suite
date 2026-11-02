# Staff console (manager now; admin, super admin, developer next)

The manager portal is a port of the owner's prototype "Graphite console" into the real app.

- **Prototype (look + behaviour):** `C:\Users\Prithish Sai Reddy\Projects\sbc-vcfo-local\source\portal\`
  - frame `v4/mgr_body.txt`; styles `v4/css_mgr.txt` (already copied to `css-src/30-console.css`)
  - logic `v4js/a59m_mgr_data.js` (sample data: read it to understand shapes, never ship it), `a59n_mgr_shell.js`
    (frame, shared pieces, router, bells, search, chat), `a59o_mgr_today.js` (Today), `a59p_mgr_work.js` (My work,
    Project leads, Team load, task drawer, calendar, plan my week), `a59q_mgr_pages.js` (Approvals, Date requests,
    Clients, client overview, step page, documents pack, board resolution, Email, Vault, Knowledge bank,
    Announcements, Notifications, Compliance calendar, Filings register, Analytics, Audit log, Settings),
    `a59r_mgr_pages2.js` + `a59s_mgr_layouts.js` (the v2 page layouts that REPLACE some first versions — read both and
    use the later one), `a59x_newproj.js` (New project → NOC wizard), `a59y_console.js` (Graphite rail).
  - Functional spec of the manager portal: `sbc-vcfo-local/docs/manager-portal-inventory.md`.
- **The live tool is the reference (owner, 2026-10-29).** What runs at app.sbctrack.in is `origin/main` (last deploy
  19 Oct 2026, `ee3d905`); this branch contains all of it, plus the newer Ask VCFO work. Bring **every live operation**
  into the new page exactly as it works today, even where it looks wrong. Do not fix live behaviour on the way: list
  anything that looks like a mistake in your report under **"Live behaviour that looks wrong"** (what, where, why) —
  the owner fixes those afterwards. To see the live version of a file: `git show origin/main:<path>`.
- **Real functionality (source of truth):** the current app. Old manager views are still in `src/views/admin/*`,
  `src/views/staff/*`, `src/views/manager/*`, `src/views/compliances/*`, `src/views/knowledge-bank/*`,
  `src/views/announcements/*`, `src/views/notifications/*`, `src/views/engagement/*`, `src/views/settings/*` and the API
  routes under `app/api/*`. **Admin and super admin still render those views, so do not delete or change them.** Read them
  to learn every real function; reuse their hooks and API calls; copy small pure helpers if needed.

## How the console is built

| File | What it is |
|---|---|
| `ConsoleRoot.tsx` | `ConsoleGate` (role check) → providers → `.cpx.gx` root with `data-seat`, sprite, frame, overlays |
| `runtime.tsx` | `useConsole()`: `seat`, `me`, `go(href)`, `scope` (stage filter all/inc/cmp), `openPop`, `openModal`, `openDrawer`, `toast(msg, undo?)`, `openChat(q?)`, `theme`; hooks `useCrumbs`, `useConsoleBadge`, `useConsolePalette` |
| `overlays.tsx` | `PopHead`, `Drill` (breakdown pop-up), `Menu`, `ModalBody`, `DrawerHead`, palette, toast with Undo |
| `ui.tsx` | `Panel`, `StageTag`, `Empty`, `Dot`, `ClientAv`, `LeadAv`, `hueOf`, `Donut`, `Legend`, `Field`, `Select`, `Spark` + the portal atoms (`Icon`, `Btn`, `IconBtn`, `GoArrow`, `Seg`, `Pill`, `StatusPill`, `LawChip`, `DateTile`, `Timer`) |
| `nav.ts` | the seat's sections and pages (real routes) |
| `Frame.tsx` | icon rail + hover panel + top bar + phone tabs; renders the page |
| `seats/extras.tsx` | sidebar extras per nav key (`leads`, `clients`, `@mini`) — register yours here |
| `updates.tsx`, `ConsoleAsk.tsx` | bells and Ask VCFO (contracts in the files) |
| `pages/<area>/<Page>.tsx` | one component per route; `app/app/manager/**/page.tsx` only renders it |
| `css-src/` → `css/` | prototype CSS (verbatim) + yours (`css-src/96-<area>.css`), built by `node scripts/portal-css.mjs` |

- Pages are **real Next routes** inside the persistent frame: use `useConsole().go(href)` (router push) or `<a href>`;
  read params with `useParams()`; set the top-bar trail with `useCrumbs(['Clients', name, step])`.
- The prototype's `mxGo(view, arg)` → a route; its `MS` session state → React state / `sessionStorage` where the
  prototype remembered it for the session (picked lead, folded groups).
- **Markup:** use the prototype's class names and DOM (`glass panel mx-p`, `ph`, `mx-pt`, `pill over`, `mx-drow`, …).
  The CSS is loaded, so the right markup is styled with no extra CSS. Section sheets bundle before the prototype
  sheet: if a rule of yours ties on specificity, double the class (`.x.x`).
- The prototype's top-bar switch "View book as" pretended every client was in one stage (a sample-data trick). Ours
  is a real **Stage** filter: `useConsole().scope` = `all` | `inc` | `cmp`. Pages and panels follow it.
- KPI trend lines: `<Spark series={…} />` only with a **real** daily series; otherwise no line (the prototype's were
  invented).

## Rules (owner + repo)

1. **Real data only.** Every number, name, date and status comes from the database through `/api/*` routes that run
   the repositories under the caller's `AuthContext` (a manager sees only their own book). Never ship the prototype's
   sample data (Pranay, Bharath, Northwind Technologies, Orchid Lane…). No "coming soon". No invented history.
2. **Keep every real function** the old manager pages have (approve / reject / request changes, assign leads, edit
   schedule windows, create project, doc pack, board resolution finalise, email send via Outlook, templates, vault,
   knowledge bank upload / delete (managers only), regulatory-update approve / reject, mark-read, exports, audit,
   settings, WhatsApp, Outlook connect). Only the look changes. Add what the prototype adds when the data exists.
3. **Backend changes are allowed** when a prototype screen needs data the API does not return yet. Follow the seam: only
   `src/db/repositories/*` imports `db`; every repository function takes an `AuthContext` and scopes by role; routes call
   repositories; add tests for new repository logic and pure helpers. No migration without a clear reason; if one is
   needed, change `src/db/schema.ts` and generate it into `src/db/migrations/` with `npm run db:generate` (additive
   only), apply it locally with `npm run db:migrate`, and say so in your report.
4. Use the real tool's names (step titles from `src/data/checklist.ts`, filing names from the register, people's names).
5. Do not commit or push. Do not start `next dev` (one runs on :3000). Do not edit another area's files or the shared
   console files (`runtime.tsx`, `overlays.tsx`, `ui.tsx`, `Frame.tsx`, `nav.ts`, `ConsoleRoot.tsx`); if you need a
   shared change, make a local helper and say so in your report.
6. **LIGHT MODE (owner, 2026-10-29: "I need the work done very soon").** Up to eight agents run at once on a 16 GB
   laptop, so: **never run `npx tsc`, `next build`, a repo-wide lint, or a headless browser / screenshot.** The lead
   session typechecks centrally and does the visual QA, and sends you the errors and findings to fix. You may run only
   your own new test files: `npx vitest run <files> --maxWorkers=1`. Because you cannot typecheck, read the real types
   (`src/db/schema.ts`, the repository return types, the API route handlers, `src/lib/*` types) before you use them.

## Detail standard (the owner: "anything means anything — even a dot, an alignment, a label")

The manager portal keeps the prototype's design. That does not lower the bar on detail: every page must pass this list
before you report it done. Fix what fails.

**Alignment and spacing**
- Use the prototype's own classes for spacing; never add one-off margins to "make it fit". Panels in a row share the same
  top edge and the same inner padding; panel headers (`.ph`) line up across a row.
- Text in a list starts on one vertical line; icons in a list are the same size (16 px in rows and buttons, 18–19 px in
  navigation) and vertically centred with their label; dots are centred on the text's x-height, not the top.
- Numbers use tabular figures and are right-aligned in tables and stat columns; units and labels never wrap under a
  number by accident.
- No text is clipped. Long names truncate with an ellipsis and carry a `title` with the full text.

**Every mark explains itself**
- Every colour, dot, ring, bar or badge has a legend on the panel or a tooltip (`title`) saying what it means.
- Every count is a door (prototype rule): clicking it opens the breakdown (`Drill`) or the page where the list lives.
  If a count cannot be opened, it is not styled as a button.
- One vocabulary everywhere. Steps / tasks: Overdue, Due this week, In progress, Waiting on client, Not started, Done.
  Filings: Filed on time, Filed late, Overdue, Due this week, Upcoming. Health: On track, At risk, Stuck, New.
  Who holds it, always with the days it has been there: You, Client, Manager, MCA.
- Red means overdue or blocked, amber means due soon or needs you, green means done, accent (teal) means current /
  selected. Do not reuse these colours for anything else.

**Words**
- Sentence case; buttons are verbs ("Approve", "Send back", "Assign"); no full stops on buttons or labels.
- Plurals agree ("1 client", "2 clients"); zero states are plain sentences ("Nothing is waiting for your approval").
- Dates: "16 Oct" this year, "16 Oct 2025" otherwise, "Fri 16 Oct" where the weekday matters; times "2:30 pm"; ages
  "3d", "5 days late". Use `src/components/portal/dates.ts`.
- Names are real people's names from the database; a person's role sits next to their name the first time it appears.

**States**
- Loading: the page frame shows at once with quiet "Loading …" lines; no layout jump when data arrives.
- Empty: a short sentence that says what will appear here and when.
- Error: what failed, in plain words, with a Try again button.
- Hover, focus-visible and pressed states on everything clickable; keyboard reaches every action; Escape closes overlays.

**Themes and widths**
- Check dark (default) and light, at 1440, 1280, 1024 and 390 px. No sideways page scroll (wide tables scroll inside
  their panel), nothing overlaps the sticky top bar or the Ask VCFO button.

**Checking**
- In light mode the lead session takes the screenshots (1440 / 1280 / 1024 / 390, dark and light) and sends you what to
  fix. Before you report done, go through the list above by reading your own markup line by line.
- Demo logins (password `demo1234`) if you need to reason about data: managers `pm-anita@demo.vcfo.local`, `pm-joseph@…`,
  `pm-leena@…`; admins `admin-nadia@…`, `admin-vikram@…`. Never use or change real accounts (`@sbcllp.in`).
