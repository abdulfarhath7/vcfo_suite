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

## "Coming soon" tags

`docs/context/STATE.md` (10 Nov 2026) lists these modules as built but not yet deployed:

- Receivables (U8), including bank matching and the nine-currency forex desk
- Payroll and labour registers
- Automation wave 2 (U5): request lists, expiry alerts, notice escalations, client health, My day and the weekly digest
- The Ask VCFO file drop (up to 50 files)

Each one carries a small amber "Coming soon" tag. Board meetings (U7) went live on 3 Nov, so it is not tagged. Once the rest are live, rebuild without the tags:

```bash
cd docs/collateral/vcfo-suite/build && npm install
```

```bash
COMING_SOON=0 ./build.sh
```

With the tags off, slide 11 of the deck goes back to "Every claim here is a shipped feature we can show live."

## Placeholders for SBC to fill

No numbers were invented. Every figure is one from the prompt (34 steps, 5 roles, 224 agenda items, 9 currencies, 50 files, T-60/T-30/T-7, T-7/T-2, AWS Mumbai). Anything else is a marked placeholder.

**Brochure**

- Page 12 title: "From first call to live in [SBC to confirm] days".
- Page 12, the four phase cards: "[SBC to confirm] weeks" for each phase.
- Page 12, third stat tile: "[SBC to confirm]" days from first call to certificate of incorporation.
- Page 10, the role table: check the simplified scopes (All, Team, Assigned, Own company) against the live permissions.

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
