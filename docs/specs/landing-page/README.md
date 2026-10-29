# Landing page prototype

`vcfo-landing-prototype.html` is a self-contained marketing page for VCFO Suite: one file, no
dependencies beyond Google Fonts (Public Sans and IBM Plex Mono). Open it in a browser or send
it as an attachment. It is a prototype for review, not a Next.js route; the live marketing page
still lives in `src/components/marketing/`.

## What is on it

The page tells a layman what the product does, in the order the work happens, with a diagram for
each stage. Every diagram is drawn from repository data, not invented:

- The journey line (name and papers, incorporation, certificate, the first 180 days,
  registrations, then the yearly calendar) follows the phases in `src/data/checklist.ts`.
- The incorporation swimlane (Client, Firm, MCA) follows the sixteen pre-incorporation steps and
  their `responsibleRole`, and names the generated documents from `src/lib/incorporation-docs/`.
- The 180-day timeline uses the `deadline` rules on the post-incorporation steps (30, 60 and
  180 days from incorporation).
- The registrations hub groups the 23 `statutory` steps by regulator.
- The compliance ring is generated in the page script from the obligation rules in
  `src/lib/compliance/obligations-seed.ts` and the statutory calendar in
  `src/data/statutory-calendar-fy2627.ts`.
- The product screenshots are real captures of the demo-seeded app (client overview, client
  incorporation, project lead Today, manager dashboard, Ask VCFO panel), taken in light mode at
  1440 by 900, 2x.

Design: the dark theme of `docs/design/design-tokens.json`, locked for the whole page. Blue is
the one action colour, orange appears once per region (the "Needs you" chip), status colours
always carry a word, charts use the six data hues. Motion runs on IntersectionObserver reveals,
a sticky story panel, CSS keyframes and CSS scroll-driven animations where the browser supports
them; everything collapses to a static page under `prefers-reduced-motion`.

## The merged demo (landing page plus live prototype)

`dist/vcfo-suite.html` (about 13 MB, gitignored) is one offline file: the landing page first, then the
clickable prototype v10 behind it. Every product image, chip, timeline pin, journey node and trust card
carries a `data-app="<route>"` attribute; clicking it opens that prototype screen full-screen, with a
slim top strip ("Back to site", the screen name, Esc to close). Browser Back steps through the screens
you opened. The product opens only after "Sign in"; the sign-in card has three demo buttons that fill
the form and sign in: Client (Rohan Kumar, Northwind), Lead (Bharath), Manager (Pranay), Admin (Krishna), Super admin (Mithilesh) and Developer (Farhath).
All six use the password `demo2026`. There is no public "Try it live".

The build reads the prototype from `~/Documents/reference/vcfo-suite/vcfo-prototype-v10.html`
(override with `--prototype <path>` or `VCFO_PROTOTYPE`) and never edits it. It copies the payload
script verbatim and applies five asserted patches to the runtime: lazy boot (the 12 MB JSON is parsed
at idle, after the landing has painted), no autostart plus a small `window.__vcfoApp` API, Escape
forwarding from inside screens, a fresh iframe per screen so in-app navigation adds no history
entries, and hash changes by `location.replace`. The prototype's own intro is dropped. Without the
prototype file the build writes only the landing page, and the click-through stays hidden.

The landing screenshots are captured from the prototype itself (Northwind, Kavya, Priya), so a click
opens what the image shows. The three portal tab images were recaptured from v10 on 23 October.

## The logo reveal

The three cards (Incorporation, Registrations, Compliances) rise, stack, the V and the wordmark
appear, and the lockup glides into the navbar logo slot while the hero fades in. It is the
prototype's intro timeline on the dark stage, about 4 seconds, on every load (the page starts at the top), never under reduced motion. Any scroll, key or click skips it. Fonts (Public
Sans, IBM Plex Mono, Poppins for the wordmark) are inlined from `src/fonts/`, so both outputs work
offline.

## The Ask VCFO guide

A floating "Ask VCFO" pill (the prototype's robot) opens a small panel with ten suggested questions
for visitors: what the product covers, incorporation, the first 180 days, registrations, the
calendar, the client, lead and manager views, hosting, and whether it is only for SBC. Answers are scripted
from the page's own copy, so the guide never states a wrong date or rule; there is no free-text
box. Each answer has "Show me", which opens the matching prototype screen in the merged demo and
scrolls to the matching section in the landing-only build, and "Book a demo". The pill hides during
the reveal and while the prototype is open.

## The prototype fixes (v10)

`src/proto-fix/patch.mjs` reads the owner's prototype, applies the design-system fixes listed in
`PROTOTYPE-AUDIT.md` (one table look, Public Sans, token colours, radii, copy and dates, no page titles,
working breadcrumbs), and writes `~/Documents/reference/vcfo-suite/vcfo-prototype-v10.html`.
`src/proto-fix/ds.css` is the stylesheet it adds to every screen. Each client keeps its own colour
(owner's decision); people stay neutral.

The source is `~/Documents/reference/vcfo-suite/vcfo-dashboard-2026-10-23.html`, the owner's
"VCFO Dashboard.html" of 23 October. It is v8 plus lead additions (a hover list on the action queue,
"My work" status and area cards on Work, clickable locked timeline bars, its own sign-out button and
breadcrumb links) and a new Manager portal under `s/mgr/` (routes `mgr-*`): Today with team tasks and
a status breakdown, My leads with each lead's work, and assigning to-dos to interns. The manager
screens are copies of the lead screens, so every lead fix runs on both. The manager is Pranay (the source still said Kavya). The older v8 and v9 files stay in the same folder.

```bash
node docs/specs/landing-page/src/proto-fix/patch.mjs && node docs/specs/landing-page/src/build.mjs
```

## How to rebuild

The page is built from `src/landing.template.html`. The template references images as
`{{IMG:name}}` (inlined as base64 WebP from `src/img/`) and icons as `{{ICON:name}}` (lucide
paths from `src/icons.json`, the same icon family the app uses). Edit the template, then:

```bash
node docs/specs/landing-page/src/build.mjs
```

The build fails if an icon is missing or an em dash or en dash appears in page text.

To preview from the Claude desk, the `landing` entry in `.claude/launch.json` serves this folder
on port 8788. To recapture product screenshots, log in to the running dev server with the
demo-seeded users and screenshot at 1440 by 900 with `deviceScaleFactor: 2`, then crop and
convert to WebP (quality 76 to 80) into `src/img/`.

## Reference material used

- `https://solcis.ai/` for the dark cinematic hero, the sticky step narrative and the status
  record animation.
- `~/Documents/reference/vcfo-suite/finance-ui-refs/` (36 finance and compliance sites) for
  hero, trust and section rhythm.
- `~/Documents/interico/prototype/index.html` for role sections with live charts and plain
  captions that say what a chart means.

## The admin portal and the people (v10)

The prototype has four portals. Client: Rohan Kumar at Northwind. Project lead: Bharath. Manager: Pranay, whose project leads are Bharath, Sneha Kulkarni and Meera Nair. Admin: Krishna, who oversees Pranay, Priya Raman and Arjun Mehta and 14 clients. Super admin: Mithilesh, who sees the whole firm, including a second admin, Ritu Agarwal, and her manager Vikram Shah (17 clients in all). The super admin screens are in `src/proto-fix/super/` and share `src/proto-fix/admin/data.js`. "Intern" is called "project lead" everywhere.

The admin screens are source files in `src/proto-fix/admin/` (data, sidebar, Today, Work, Managers, Clients, the assign dialog, shared CSS). `patch.mjs` loads them into the bundle under `s/admin/`, copies the remaining screens from the manager portal, and adds the `admin-*` routes. Edit the files there and rerun the two build commands.

The developer console (Farhath) covers SBC's own setup: connections, message routing, jobs, logs, deploys, access and secrets, data and costs, and an audit of every change. Its screens are in `src/proto-fix/dev/`; every action goes through one confirm dialog. Every staff home and the client home also carry the practice-areas row from `src/proto-fix/shared/`.

## The Lovable brief pack (cards and dashboards)

`lovable/` holds the pack for the Lovable round that polishes the old prototype's cards and
dashboards: `KNOWLEDGE.md` (the project knowledge to paste into Lovable), `PROMPTS.md` (the
ordered prompts with a credit cap each and a ledger), `refs/old/` (the old dashboards at 1440 and
390 px, captured from `vcfo-prototype-v10.html` with the prototype bar hidden), `refs/look/`
(Karbon, TaxDome and Mercury captures from `reference/vcfo-suite/finance-ui-refs`) and `data/`
(every label, number, name and date of each dashboard, card by card). Lovable renders the shell,
three dashboards and a cards sheet; the finish then comes back into `src/proto-fix/ds.css` and
`patch.mjs`, so every screen of the old prototype gets it. The landing page is not part of that round.
