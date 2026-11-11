# VCFO Suite collateral

These are the three sales documents built from the prompts in `VCFO-SUITE-COLLATERAL-PROMPTS.md`. Each file covers the whole tool, and the ten unique features (U1 to U10) get the most space.

| File | Format | Where the unique features lead |
|---|---|---|
| `VCFO_Suite_Brochure.pptx` / `.pdf` | 14 pages, A4 portrait | The cover (U1 to U4), page 2, the hero panels on pages 5 to 10, and page 13 (all ten) |
| `VCFO_Suite_Corporate_Deck.pptx` / `.pdf` | 14 slides, 16:9, speaker notes on every slide (74 to 83 words each) | Slide 4 (the whole tool), slide 6 (all ten, U1 to U4 on white cards), slide 8 (U5, U6) and slide 11 (proof) |
| `VCFO_Suite_One_Pager.pptx` / `.pdf` | 1 page, A4 portrait | The "What makes it different" band in the centre and the "Proven in the platform" chip row |

The `.pptx` files are fully editable. The PDFs have the fonts embedded and are ready to print or attach to an email.

## Design system

The documents follow the app's own design system, VCFO Spectrum (`docs/design/design-tokens.json`, version 2), so a client sees the same look on paper as in the app. They do not use the older palette in the prompt file (navy `#15263B`, orange `#E9792F`, warm `#FBF7F1`, Public Sans).

- **Type:** Roboto for text and Roboto Mono for identifiers, as in `app/layout.tsx`.
- **Colour:** navy `#0a2540` (ink and sidebar) and the cool surface `#f6f8fb`. Orange `#f26b1d` is used for marks and large figures, and `#b54708` when orange is small text. Indigo `#635bff`, the app's action colour, marks the main call to action and the call-out strips.
- **Status colours:** the app's tokens with the six status words: Done `#0b7a43`, In progress `#0a5fc2`, Waiting `#06708c`, Due soon `#9a4d00`, Overdue `#c0182f`, Not started `#4e5d73`. "Coming soon" uses the warning-banner colours (`caution`).
- **Shapes:** 6px corners on every box, a 1.5px hairline edge, a 3px coloured top edge like the app's KPI cards, rounded-square icon tiles, table heads on `surface-sunken`, no gradients, no shadows and no pills.
- **Logo:** the files in `docs/specs/brand/logo/`.

- **Family colours:** a card's 3px top edge and its icon show which part of the product it belongs to, on every page: set up the company (U1, U2, U10) is orange, keep it compliant (U5, U6, U9) is blue, board and money (U7, U8, payroll) is green, see and trust (U3, U4, security) is navy, and problems are red. Summary pages that show all ten features (brochure page 13, deck slide 6) use the orange highlight for all of them.
- **Fixed colour roles:** titles and card titles are navy ink, secondary text is `ink-muted`, small orange labels are the text-safe `highlight`, call-out strips are `brand-soft` with a `brand-text` lead, and every "Coming soon" is `caution` text on `caution-soft`. `build/audit_colors.py` lists every colour in a built file with its token name and marks anything off the palette.
- **Spacing:** one scale from the app's spacing tokens, held in `SP` in `build/shared.js`: 8px (0.08in) between chips, 12px (0.125in) between cards in a grid and between side-by-side panels, 24px (0.25in) between page sections, and 0.3in for a step-by-step flow that has an arrow in the gap. Content starts at the same height below the page heading on every page (2.55in on the brochure, 1.75in on the deck), and boxes that sit side by side share a bottom edge. `build/audit_spacing.py` lists every gap between neighbouring boxes.
- **Type sizes:** each document uses one fixed set of sizes, and every piece of text is snapped to it when the file is built, so the same kind of text has the same size on every page.

  | Role | Brochure | Corporate deck | One-pager |
  |---|---|---|---|
  | Tags and code badges | 7 | 7 | 7 |
  | Captions, footer, small labels | 7.5 | 7.5 | 7.5 (also body text) |
  | Card body, tables, section labels | 8.5 | 9 | 8.5 |
  | Body text, lists, call-outs | 9.5 | 10 | — |
  | Lede and card titles | 10.5 | 11.5 lede, 12 card titles | 9.5 |
  | Panel headings / large card titles | 12 | 14 | 13 (call to action) |
  | Sub-display and codes | 16 | 16 | — |
  | Figures and hero codes | 22 | 36 | 19 |
  | Page or slide titles | 24 | 28 | 25 (headline) |
  | Cover headline | 36 (back cover 32) | 38 | — |

All the tokens sit in one place, `build/shared.js`, so a later change to the design system means one edit and a rebuild.

Roboto and Roboto Mono are free Google Fonts. Install both on any computer that edits the `.pptx` files, or PowerPoint will substitute another font. The PDFs have the fonts embedded.

## Fact-check against the code (11 Nov 2026)

Every claim was checked against the source on `origin/main`, the deploy log in `docs/OVERNIGHT-REPORT-31OCT.md` and `docs/context/STATE.md`. The prompt file had several facts that are not true of the app, and the documents now follow the code instead:

- The checklist has **48 steps** in four phases (name application, incorporation, post-incorporation, registrations), not 34. SPICe+ Part A and Part B run in MCA order inside it. Part A collects client details, not only the name.
- Receivables (deployed 4 Nov), payroll and labour registers (9 Nov) and board meetings (3 Nov) are live, although `STATE.md` still calls some of them undeployed.
- Receivables "partners" are the client organisation's own partners, not the customer's finance contact. There are nine foreign currencies plus INR. Bank matching works from imported camt.053/054 statements; there is no live bank feed.
- Labour registers are made per client, state and month, not per establishment.
- The audit log is not append-only (rows cascade when a profile is deleted) and does not cover every action, so the documents say "key actions".
- The manager approval gate covers the board resolution, post-incorporation work and registrations. Pre-incorporation forms are filled directly by the client and the project lead.
- WhatsApp is switched off in production, Outlook can only send, and two-step sign-in is optional.
- Ask VCFO calls Anthropic's API outside India; the trust page says so.
- The "Download all" ZIP holds the incorporation drafts with a folder per director; the board resolution is separate and applies only to a company with a parent.

## "Coming soon" tags

These are built but not in production, so each carries an amber "Coming soon" tag:

- Automation wave 2 (U5): request lists, expiry alerts, notice escalations, client health and the My day card (merged 10 Nov, migration 0051 not on RDS)
- The Ask VCFO file drop of up to 50 files (merged 10 Nov, migration 0050 not on RDS)
- GST registration laid out like the REG-01 tabs (built 9 Nov, after that day's deploy)
- Event-based ROC and FEMA filings such as DIR-12 and FC-GPR (part of automation wave 2)
- The encrypted credentials vault (built, but `CREDENTIALS_ENCRYPTION_KEY` is not set on App Runner, so it fails in production)
- WhatsApp nudges (`WHATSAPP_ENABLED` is false in production)

Once they are live, rebuild without the tags:

```bash
cd docs/collateral/vcfo-suite/build && npm install
```

```bash
COMING_SOON=0 ./build.sh
```

Then remove the hand-written "coming soon" phrases in the scripts as well (search for "coming soon").

## Check before the CEO presentation

- Scheduled jobs (receivables reminders, board-meeting reminders, FX rates, digests) run on Inngest. `STATE.md` still lists the Inngest keys as pending on AWS, so confirm they fire in production before saying "automatic".
- The Teams link on a board notice needs each lead to reconnect Outlook once.
- Payroll data is still kept in the browser, not on the server.
- Ask VCFO's knowledge topics are marked "Not yet reviewed" in the app.
- Contact addresses differ: the documents and landing page use info@sbcllp.in, the client portal shows info@vcfosuite.com, and outbound mail uses the sbctrack.in domain. Pick one.
- "SBC's CA and CMA team, with SLA support" (one-pager) is a service promise; confirm it.

## Placeholders for SBC to fill

No numbers were invented. Every figure is checked against the code (48 steps, 5 roles, 224 agenda items, INR plus 9 currencies, 50 files, T-60/T-30/T-7, T-7/T-2, AWS Mumbai). Anything else is a marked placeholder.

**Brochure**

- Page 12 title: "From first call to live in [SBC to confirm] days".
- Page 12, the four phase cards: "[SBC to confirm] weeks" for each phase.
- Page 12, third stat tile: "[SBC to confirm]" days from first call to certificate of incorporation.
- Page 10, the role table: the simplified scopes (All, Own projects, Assigned, Own company) were checked against the code.

**Corporate deck**

- Slide 3, three tiles: [SBC to confirm: late fee per day for ROC filings], [SBC to confirm: typical months lost] and [SBC to confirm: penalty example]. Replace each "[ — ]" with the figure.
- Slide 3 footnote: cite the Companies Act 2013, CGST Act or Income-tax Act section behind each figure.

**One-pager**

- None. The page uses only numbers from the prompt.

## Screenshot placeholders (corporate deck)

| Slide | Placeholder | What to capture |
|---|---|---|
| 10 | Phone frame, "[Screenshot: client portal home on a phone]" | The client portal home (`/app/client`) on a phone-width window, showing the journey map, the next step and due dates. Use a demo company from `npm run db:seed-demo`. |

Good optional additions are the SPICe+ checklist with red marks (brochure page 5), the document pack (page 5), the compliance calendar (page 6) and the board meeting notice email (page 8). Those pages currently show an illustrative drawing of the screen, marked "Illustrative".

## Rebuilding

The generators are in `build/`. `shared.js` holds the brand kit (colours, icons, cards, badges), and `brochure.js`, `deck.js` and `onepager.js` each build one file. They use pptxgenjs. `shared.js` also turns every box into a 6px-cornered Spectrum box, and `vendor/apply_theme.js` writes the Spectrum colours into each file's theme, so changing a theme colour in PowerPoint recolours the whole document.

```bash
cd docs/collateral/vcfo-suite/build && npm install && ./build.sh
```

`build.sh` writes the `.pptx` files to this folder, and the PDFs as well when LibreOffice is installed.

After a rebuild, `build/audit_padding.py` checks every box on every page and reports any box whose content touches or crowds an edge, so the gap below the text matches the gap at the top and sides.

```bash
python3 build/audit_padding.py VCFO_Suite_Brochure.pptx VCFO_Suite_Brochure.pdf
```
