# Printing in VCFO Spectrum

Every PDF or printed report the firm hands out uses one stylesheet, `docs/design/print-spectrum.css`.
It is generated from `docs/design/design-tokens.json` (light theme), so a token change reaches the
PDFs the same way it reaches the app.

## Files

| File | What it is |
|---|---|
| `scripts/design-tokens-print.mjs` | Writes `print-spectrum.css`. It first checks the contrast of every text and ground pair the print components use (WCAG, the same formula as `design-tokens-check.mjs`) and refuses to write on a failure. |
| `docs/design/print-spectrum.css` | Generated. Do not edit it by hand. |
| `scripts/render-print.mjs` | Renders an HTML page or a markdown file to an A4 PDF with Playwright, and checks every sheet for overflow. |
| `docs/design/print-sources/*.html` | The HTML sources of the PDFs we keep in the repo, so they can be rendered again after a token change. |

```bash
node scripts/design-tokens-print.mjs --write
node scripts/render-print.mjs docs/design/print-sources/legal-visual.html "docs/specs/mca-connect/reports/VCFO Assist legal review (visual).pdf"
node scripts/render-print.mjs docs/OVERNIGHT-REPORT.md docs/OVERNIGHT-REPORT.pdf
# add --shots <dir> to save a PNG of each sheet and look at it before you share the PDF
```

## Writing a page

Put the Google Fonts link from the header of `print-spectrum.css` (Roboto 400/500/700 and Roboto
Mono, rule R-28) in the `<head>`, then link the stylesheet. A source in `print-sources/` uses
`../print-spectrum.css`. Each printed page is one `<section class="page">`: a fixed A4 sheet with
the regulator ribbon (R-46) across its top and a `.foot` line with the source and the page number.
The render script fails if anything spills past the sheet's padding or into the footer, and blocks
on a sheet never shrink to hide it.

| Need | Class | Mirrors |
|---|---|---|
| Cover band | `.wash` with `.kicker`, `.mark-gold`, `h1`, `.lead`; white tiles on it are `.wash-tile` | `DashHero` |
| Page title | `.page-head` (kicker, `h2`, lead, 2px ink rule) | page head |
| Card | `.card`; with a head row `.card.flush` + `.card-head` + `.card-body` | `DashSection` |
| Number card | `.card.stat.t-<tone>` with `.fig` (3px top edge in the tone) | `StatCard` |
| Status | `.chip.t-<tone>`; `.col` in a table column (104px), `.sm`, `.solid`, `.nodot` | `Chip` |
| Owner or person | `.tag` (neutral; add `.t-<tone>` only when it means a state) | `Tag` |
| Steps | `.steps > .st` with `.step.done / .now / .next` and `.st-title` | `StepMark`, `StepLink` |
| Checkbox | `.check`, `.check.done` | R-57 |
| Table | `table` inside `.table-card` or a `.card.flush` | `DashDataTable` |
| Note | `.callout` (info) | `Alert` |
| Disclaimer | `.disclaimer` (caution ground and edge) | |
| SVG paint | `class="fill-<token>"`, `class="stroke-<token>"` for any colour token | |

Tones are `ok` (Done), `warn` (Due soon), `bad` (Overdue), `prog` (In progress), `idle`
(Not started), `teal` (Waiting) and `violet` (MCA), as in `src/components/ui/spectrum-chip.tsx`,
plus `info` for notes. A `.t-<tone>` class sets `--tone`, `--tone-soft`, `--tone-mark` and
`--tone-solid`, which every component reads.

## Verdict words in legal and policy documents

Use the same tone for the same word everywhere: Allowed is `ok`, With conditions is `prog`,
Legal opinion is `warn`, Prohibited is `bad`. A date that has not started yet is `idle`.

## The Spectrum rules that apply on paper

One radius (6px, 4px on marks, 3px on bars). No pills, no dashed or dotted edges (R-56), no
coloured left borders, and no gradient except the cover wash and the ribbon. Colour sits in
chips, marks, the 3px stat edge and diagram lanes, always with a word. Text uses the text-safe
tokens (`positive`, `warning`, `danger`, `brand-text`, `info`); the `-mid` tokens are for marks
only. Identifiers and file paths use `.mono`.
