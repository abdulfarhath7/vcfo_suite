# VCFO Suite collateral

These are the three sales documents built from the prompts in `VCFO-SUITE-COLLATERAL-PROMPTS.md`. Each file covers the whole tool, and the ten unique features (U1 to U10) get the most space.

| File | Format | Where the unique features lead |
|---|---|---|
| `VCFO_Suite_Brochure.pptx` / `.pdf` | 14 pages, A4 portrait | The cover (U1 to U4), page 2, the hero panels on pages 5 to 10, and page 13 (all ten) |
| `VCFO_Suite_Corporate_Deck.pptx` / `.pdf` | 14 slides, 16:9, speaker notes on every slide (74 to 83 words each) | Slide 4 (the whole tool), slide 6 (all ten, U1 to U4 in orange), slide 8 (U5, U6) and slide 11 (proof) |
| `VCFO_Suite_One_Pager.pptx` / `.pdf` | 1 page, A4 portrait | The "What makes it different" band in the centre and the "Proven in the platform" chip row |

The `.pptx` files are fully editable. The PDFs have the fonts embedded and are ready to print or attach to an email.

## Brand

The documents use navy `#15263B`, logo orange `#E9792F` for highlights only, and the logo gradient once (a thin rule on the brochure and deck covers). Surfaces are white and `#FBF7F1`. The status colours and the six status words (Not started, In progress, Waiting, Due soon, Overdue, Done) match the app. Text is set in Public Sans, and identifiers in IBM Plex Mono. The logo comes from `docs/specs/brand/logo/`.

Public Sans and IBM Plex Mono are free Google Fonts. Install both on any computer that edits the `.pptx` files, or PowerPoint will substitute another font.

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

The generators are in `build/`. `shared.js` holds the brand kit (colours, icons, cards, badges), and `brochure.js`, `deck.js` and `onepager.js` each build one file. They use pptxgenjs, and `vendor/apply_theme.js` writes the brand colours into each file's theme, so changing a theme colour in PowerPoint recolours the whole document.

```bash
cd docs/collateral/vcfo-suite/build && npm install && ./build.sh
```

`build.sh` writes the `.pptx` files to this folder, and the PDFs as well when LibreOffice is installed.
