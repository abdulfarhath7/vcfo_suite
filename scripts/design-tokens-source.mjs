// Generates docs/design/design-tokens.json for VCFO Suite in the Interico shape.
// Hex is the design value; `oklch` is the channel triplet the app's globals.css uses
// (oklch(var(--token) / <alpha>)). Usage: node gen-tokens.mjs > design-tokens.json
const C = (name, light, dark, usage) => ({ name, value: { light, dark }, usage });

const color = [
  C('surface', '#f7f9fc', '#0b1521', 'Page canvas behind everything. Cool off-white; deep navy in dark. Never pure white, never pure black.'),
  C('surface-raised', '#ffffff', '#111d2c', 'Cards, tables, dialogs, popovers, the top bar. Sits on surface with a line hairline and shadow-card.'),
  C('surface-sunken', '#eef2f7', '#070e18', 'Wells: table header rows, input backgrounds on raised cards, empty-state grounds, skeleton blocks.'),
  C('line', '#e1e7ef', '#1f2d40', '1px hairline between rows and around cards. Decorative; never the only edge of a control.'),
  C('line-strong', '#7a8ca2', '#56698a', 'Borders of inputs, checkboxes and secondary buttons. Holds 3:1 on surface and surface-raised.'),
  C('rule', '{ink}', '{ink}', '2px structural rule under page heads and table heads, above totals rows. Same colour as ink in both themes.'),
  C('ink', '#0f2a4a', '#e9eff6', 'Primary text and figures on every surface and every -soft ground. Navy, never black.'),
  C('ink-muted', '#4b5b70', '#a5b4c6', 'Secondary text: meta, captions, helper text, table head text. 4.5:1 on every ground it is used on.'),
  C('ink-faint', '#7b8a9e', '#6f8097', 'Placeholders, disabled labels, locked steps, the Other series. 3:1 only; never body text.'),
  C('brand', '#1b4f94', '#6aa2e8', 'The one action colour: primary buttons, links, active navigation, selection, progress, the current step. Text-safe in both themes.'),
  C('brand-strong', '#163f78', '#86b6ef', 'Hover and pressed state of brand; link hover.'),
  C('brand-soft', '#e8f0fa', '#1a3654', 'Selected rows, the current step ground, active nav ground, the brand wash behind a callout.'),
  C('on-brand', '#ffffff', '#0b1521', 'Text and icons on a brand fill. White in light; navy on the lighter dark-mode blue.'),
  C('highlight', '#a8520f', '#f2a35b', 'Text-safe orange, the one highlight per screen region: what needs the user, the next payment, a new-item count, the version chip. Never a button, never page atmosphere.'),
  C('highlight-bright', '#e07a1f', '#f08a3a', 'Orange for marks with no small text: a 3px top edge, a dot beside a label. 3:1 on surface-raised.'),
  C('highlight-soft', '#fdf0e3', '#3f2a16', 'Ground of small orange chips only. Never a large block; it turns muddy in dark mode.'),
  C('positive', '#0f6e51', '#4fc99a', 'Done, filed, paid, on track. Text-safe on surfaces and on positive-soft. Always with a word.'),
  C('positive-soft', '#e1f3ec', '#12392d', 'Ground of positive chips and compare-table rows.'),
  C('warning', '#be4400', '#f08a3a', 'Due soon, waiting on someone, at risk. The prototype orange: a solid chip with on-status text, or text on a surface. Always with a word.'),
  C('warning-soft', '#ffeedc', '#3d2410', 'Ground of warning chips and the changed rows of a compare table.'),
  C('danger', '#b5302a', '#f27b72', 'Overdue, failed, rejected, destructive actions. Always with a word.'),
  C('danger-soft', '#fbe7e5', '#421a16', 'Ground of danger chips and removed rows.'),
  C('info', '#0f6e8c', '#5cc0dc', 'Notes, internal-only bands, neutral callouts. Teal, so it never reads as the brand.'),
  C('info-soft', '#e2f1f6', '#10343f', 'Ground of info callouts and the lock-marked internal band.'),
  C('upcoming', '#656f7e', '#7d8a9c', 'The fifth state: not started, upcoming, queued. A solid chip with on-status text, or a grey mark. Not for prose.'),
  C('upcoming-soft', '#e6eaf0', '#243246', 'Ground of upcoming chips, empty heatmap cells, the track of a progress bar.'),
  C('on-status', '#ffffff', '#0b1521', 'Text on a solid status fill (positive, warning, danger, brand, upcoming). White in light; navy on the lighter dark fills.'),
  C('gold', '#c9a24b', '#e0bd66', 'The brand mark, as marks only: the 3px underline in the greeting card, the ring around the current step, the sidebar active rail, a card top tab. 3:1 on navy, not on white, so it never carries text.'),
  C('gold-text', '#7a5a12', '#e8c97d', 'The only gold that touches words: a version chip, a "you own this" label. 4.5:1 on surfaces.'),
  C('owner-client', '#9b3b08', '#f2a35b', 'Owner chip text: the client holds this step. Soft tint only, never a solid fill.'),
  C('owner-client-soft', '#ffeedc', '#3f2a16', 'Ground of the client owner chip.'),
  C('owner-sbc', '#0a4f94', '#86b6ef', 'Owner chip text: SBC holds this step.'),
  C('owner-sbc-soft', '#e5f4ff', '#1a3654', 'Ground of the SBC owner chip.'),
  C('owner-mca', '#0f6b5f', '#5cd0c0', 'Owner chip text: with the MCA or another authority.'),
  C('owner-mca-soft', '#ddf3ef', '#113a35', 'Ground of the MCA owner chip.'),
  C('owner-manager', '#5b3fb8', '#b8a6f2', 'Owner chip text: with a manager.'),
  C('owner-manager-soft', '#efeafd', '#2b2350', 'Ground of the manager owner chip.'),
  C('hero-gradient', 'linear-gradient(115deg, #0f2a4a 0%, #17396b 52%, #1b4f94 100%)', 'linear-gradient(115deg, #0b1521 0%, #112542 55%, #17304d 100%)', 'The greeting card ground, the one gradient in the product. Everything else is flat.'),
  C('focus-ring', '#3b82f6', '#86b6ef', '2px solid outline, offset 2px, on every interactive element. Holds 3:1 on every surface including the navy sidebar.'),
  C('scrim', 'rgba(15, 42, 74, 0.55)', 'rgba(0, 0, 0, 0.65)', 'Behind dialogs and bottom sheets. The only translucent colour; nothing uses blur.'),
  C('side', '#0f2a4a', '#0b1521', 'Desktop sidebar ground. Navy gives the app its weight; in dark mode it matches the surface and side-line separates it.'),
  C('side-ink', '#e9eff6', '#e9eff6', 'Sidebar labels and icons.'),
  C('side-muted', '#9fb0c6', '#8d9db3', 'Sidebar group titles and meta. 4.5:1 on side.'),
  C('side-active', '#1d3d64', '#17304d', 'Ground of the active sidebar item; its icon is side-ink.'),
  C('side-line', '#23405f', '#1f2d40', 'Hairline between sidebar groups and along the sidebar edge.'),
  C('data-1', '#2a78d6', '#3987e5', 'Chart series 1 (blue). Categorical slots are assigned in fixed order, never cycled, and never used for UI chips.'),
  C('data-2', '#eb6834', '#d95926', 'Chart series 2 (orange).'),
  C('data-3', '#1baf7a', '#199e70', 'Chart series 3 (aqua). Below 3:1 on the light surface: needs direct labels or a table view.'),
  C('data-4', '#eda100', '#c98500', 'Chart series 4 (yellow). Below 3:1 on the light surface: needs direct labels or a table view.'),
  C('data-5', '#6250d6', '#9085e9', 'Chart series 5 (violet).'),
  C('data-6', '#008300', '#008300', 'Chart series 6 (green). Past six series, fold to Other (ink-faint) or facet.'),
];

const hex2rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16) / 255);
const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
function oklch(h) {
  if (!/^#[0-9a-f]{6}$/i.test(h)) return null;
  const [r,g,b] = hex2rgb(h).map(lin);
  const l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b;
  const m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b;
  const s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_;
  const a = 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_;
  const bb = 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_;
  const Cc = Math.hypot(a, bb);
  let H = Math.atan2(bb, a) * 180 / Math.PI; if (H < 0) H += 360;
  if (Cc < 0.002) H = 0;
  return `${(L*100).toFixed(1)}% ${Cc.toFixed(3)} ${H.toFixed(0)}`;
}
for (const t of color) {
  const l = oklch(t.value.light), d = oklch(t.value.dark);
  if (l && d) t.oklch = { light: l, dark: d };
}

const S = (name, fontSize, lineHeight, fontWeight, letterSpacing, sample, usage, extra = {}) =>
  ({ name, fontSize, lineHeight, fontWeight, letterSpacing, sample, usage, ...extra });

const type = {
  fonts: [
    { family: 'ui', name: 'Public Sans', source: 'next/font/google Public_Sans, subsets latin, weights 400 500 600', note: 'One face for display and body. No serif, no second sans.' },
    { family: 'mono', name: 'IBM Plex Mono', source: 'next/font/google IBM_Plex_Mono, weights 400 500', note: 'Identifiers only: CIN, PAN, DIN, GSTIN, file names, codes.' },
  ],
  families: {
    ui: "var(--font-sans), 'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "var(--font-mono), 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
  },
  groups: [
    { name: 'Display', family: 'ui', styles: [
      S('display-xl', '28px', '34px', 600, '-0.015em', 'Good morning, Priya', 'One per screen at most: the greeting on Today, the company name on a client home.'),
      S('display', '22px', '28px', 600, '-0.01em', 'Compliance calendar', 'Page titles. Sits above a 2px rule.'),
    ] },
    { name: 'Text', family: 'ui', styles: [
      S('title', '15px', '20px', 600, '0', 'Board resolution', 'Card, dialog and drawer titles.'),
      S('heading', '13px', '18px', 600, '0', 'Pre-incorporation', 'Group headers inside cards; table group rows.'),
      S('body', '13px', '18px', 400, '0', 'Eleven of fourteen filings are done.', 'Default UI text and table cells on desktop.'),
      S('body-lg', '15px', '22px', 400, '0', 'Your incorporation is on track.', 'Client portal reading text and phone screens.'),
      S('body-sm', '12px', '16px', 400, '0', 'Updated 24 Oct, 10:42 am', 'Meta, captions, timestamps, helper text; usually ink-muted.'),
      S('label', '11px', '16px', 600, '0.06em', 'DUE DATE', 'Section heads, table heads, stat labels. Uppercase is applied by the style; write sentence case.', { textTransform: 'uppercase' }),
      S('chip', '11px', '16px', 600, '0', 'Due 24 Oct', 'Status and count chips. Sentence case, never uppercase.'),
    ] },
    { name: 'Figures', family: 'ui', styles: [
      S('figure', '13px', '18px', 600, '0', '₹1,26,000', 'Amounts and counts inside tables; tabular numerals, right-aligned.', { fontVariantNumeric: 'tabular-nums' }),
      S('figure-lg', '20px', '24px', 600, '-0.01em', '₹9,05,178', 'Totals rows and the figure on a KPI card.', { fontVariantNumeric: 'tabular-nums' }),
      S('figure-xl', '28px', '32px', 600, '-0.015em', '11 of 14', 'The one headline number in a hero stat row.', { fontVariantNumeric: 'tabular-nums' }),
    ] },
    { name: 'Mono', family: 'mono', styles: [
      S('mono', '12px', '16px', 500, '0', 'U72900TG2026PTC184211', 'Identifiers and codes. Never for prose or amounts.'),
    ] },
  ],
};

const spacing = { tokens: [
  { name: 'space-1', value: '4px', usage: 'Icon-to-label gap, chip vertical padding.' },
  { name: 'space-2', value: '8px', usage: 'Between chips, inside inputs, icon tile padding.' },
  { name: 'space-3', value: '12px', usage: 'Table cell padding, gaps between panels in a grid.' },
  { name: 'space-4', value: '16px', usage: 'Card padding on desktop, the mobile gutter.' },
  { name: 'space-5', value: '20px', usage: 'Card padding on phone screens, dialog padding.' },
  { name: 'space-6', value: '24px', usage: 'Gap between page sections, desktop page margins.' },
  { name: 'space-8', value: '32px', usage: 'Between page regions, below the page head.' },
  { name: 'space-12', value: '48px', usage: 'Top of marketing and auth pages.' },
] };

const radius = { tokens: [
  { name: 'radius-sm', value: '6px', usage: 'Chips, inputs, checkboxes, thumbnails, table row highlights.' },
  { name: 'radius-md', value: '8px', usage: 'Buttons, nav items, icon tiles, avatars.' },
  { name: 'radius-lg', value: '10px', usage: 'Cards, dialogs, popovers, menus.' },
  { name: 'radius-xl', value: '12px', usage: 'Bottom sheets and the hero panel.' },
  { name: 'radius-pill', value: '999px', usage: 'Toggle knobs and progress rings only. Chips and avatars are not pills.' },
] };

const shadow = { tokens: [
  { name: 'shadow-card', value: { light: '0 1px 2px rgba(15, 42, 74, 0.06), 0 1px 1px rgba(15, 42, 74, 0.04)', dark: '0 1px 2px rgba(0, 0, 0, 0.5)' }, usage: 'Resting cards on surface. The hairline does the work; the shadow only lifts.' },
  { name: 'shadow-float', value: { light: '0 12px 32px -12px rgba(15, 42, 74, 0.28)', dark: '0 16px 40px -12px rgba(0, 0, 0, 0.7)' }, usage: 'Popovers, menus, sticky bars, sheets. Never stacked on a rule.' },
] };

// Control sizes. One height per tier, one minimum width, so a row of buttons or a column of
// chips reads as one block instead of a zig-zag. Taken from prototype v8 (1): chips and
// buttons gained min-width 84px and centred labels.
const size = { tokens: [
  { name: 'control-sm', value: '28px', usage: 'Buttons and inputs inside table rows and dense toolbars; icon buttons in rows.' },
  { name: 'control-md', value: '32px', usage: 'Default button and input height on desktop.' },
  { name: 'control-lg', value: '40px', usage: 'Primary actions on forms, dialogs, and every button on phone screens.' },
  { name: 'control-min-width', value: '84px', usage: 'Minimum width of any button with a text label. Labels are two words at most and never wrap.' },
  { name: 'chip-height', value: '22px', usage: 'Every status, owner and count chip. Text is the chip style, padding 0 8px, radius-sm.' },
  { name: 'chip-min-width', value: '88px', usage: 'Chips inside a table column, so the column reads as one block and labels sit centred. Chips in running text hug their content.' },
  { name: 'row-height', value: '40px', usage: 'Table rows. Chips sit vertically centred with 9px above and below.' },
  { name: 'tile', value: '32px', usage: 'Icon tiles in section heads and list rows, radius-md.' },
  { name: 'icon-sm', value: '14px', usage: 'Icons inside chips and 12px meta.' },
  { name: 'icon-md', value: '16px', usage: 'Icons in buttons, table cells and inputs.' },
  { name: 'icon-lg', value: '20px', usage: 'Sidebar navigation and phone screens.' },
] };

const borderWidth = { tokens: [
  { name: 'hairline', value: '1px', usage: 'Rows, card frames, inputs.' },
  { name: 'rule-width', value: '2px', usage: 'Structural rules: page head, table head, totals, focus outline.' },
  { name: 'stat-rule', value: '3px', usage: 'The coloured top edge of a KPI card or the next-payment card, in its tone.' },
] };

const out = {
  name: 'VCFO Suite',
  version: 1.1,
  generated: '2026-10-21',
  note: 'Hex is the design value. oklch is the channel triplet for app/globals.css (oklch(var(--token) / <alpha-value>)). {ink} means the token aliases ink.',
  color: { themes: [{ id: 'light', name: 'Light' }, { id: 'dark', name: 'Dark' }], tokens: color },
  type, spacing, radius, size, shadow, borderWidth,
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
// Source of docs/design/design-tokens.json. Run: node scripts/design-tokens-source.mjs > docs/design/design-tokens.json
