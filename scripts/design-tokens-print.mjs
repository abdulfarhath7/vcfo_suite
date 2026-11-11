// Emits docs/design/print-spectrum.css, the VCFO Spectrum stylesheet for A4 PDFs and printed
// reports, from docs/design/design-tokens.json (light theme only: paper is light).
//   node scripts/design-tokens-print.mjs            # check contrast, print the CSS to stdout
//   node scripts/design-tokens-print.mjs --write    # check contrast, write docs/design/print-spectrum.css
// Colours are written as plain hex (no oklch channel triplets), so print CSS reads var(--token)
// directly. The contrast check uses the same WCAG formula as scripts/design-tokens-check.mjs, on
// the pairs the print components put together, and exits 1 on any failure without writing.
// How to use the stylesheet: docs/design/PRINT.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = JSON.parse(readFileSync(path.join(root, 'docs/design/design-tokens.json'), 'utf8'));
const out = path.join(root, 'docs/design/print-spectrum.css');

/* ---------- token values, light theme ---------- */
const byName = Object.fromEntries(json.color.tokens.map((t) => [t.name, t.value]));
const hex = (name) => {
  const v = byName[name]?.light;
  if (v === undefined) throw new Error(`unknown token ${name}`);
  const alias = /^\{(.+)\}$/.exec(v);
  return alias ? hex(alias[1]) : v;
};
const list = (group) => Object.fromEntries((json[group]?.tokens ?? []).map((t) => [t.name, typeof t.value === 'object' ? t.value.light : t.value]));
const radius = list('radius');
const border = list('borderWidth');
const space = list('spacing');
const styles = Object.fromEntries(json.type.groups.flatMap((g) => g.styles.map((s) => [s.name, { ...s, family: s.family ?? g.family }])));
const fonts = Object.fromEntries(json.type.fonts.map((f) => [f.family, f.name]));

/* ---------- contrast gate (same formula as design-tokens-check.mjs) ---------- */
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h) => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// The six chip tones of src/components/ui/spectrum-chip.tsx, plus info for callouts and dates.
// [tone, text token, soft ground, mark fill (dot, stat edge, step ring), solid fill]
const TONES = [
  ['ok', 'positive', 'positive-soft', 'positive-mid', 'positive'],
  ['warn', 'warning', 'warning-soft', 'warning-mid', 'warning'],
  ['bad', 'danger', 'danger-soft', 'danger-mid', 'danger'],
  ['prog', 'brand-text', 'brand-soft', 'brand', 'brand'],
  ['idle', 'upcoming', 'upcoming-soft', 'upcoming-mid', 'upcoming'],
  ['teal', 'waiting', 'waiting-soft', 'waiting-mid', 'waiting'],
  ['violet', 'identity', 'identity-soft', 'identity-mid', 'identity'],
  ['info', 'info', 'info-soft', 'info-mid', 'info'],
];

// [text, ground, minimum]. Wash text is checked on the wash base colour (#e9e7ff, the last layer
// of hero-gradient), which is the lightest point the gradient can fall back to.
const WASH = /#[0-9a-f]{6}\s*$/i.exec(hex('hero-gradient'))[0].trim();
const PAIRS = [
  ['ink', 'surface-raised', 4.5], ['ink', 'surface', 4.5], ['ink', 'surface-sunken', 4.5],
  ['ink-2', 'surface-raised', 4.5], ['ink-muted', 'surface-raised', 4.5], ['ink-muted', 'surface-sunken', 4.5],
  ['ink-faint', 'surface-raised', 4.5],
  ['on-navy', 'navy-fill', 4.5], ['caution', 'caution-soft', 4.5], ['ink', 'caution-soft', 4.5],
  ['ink', 'info-soft', 4.5], ['info', 'info-soft', 4.5],
  ...TONES.flatMap(([, text, soft, , solid]) => [
    [text, soft, 4.5], [text, 'surface-raised', 4.5], ['ink', soft, 4.5], ['on-status', solid, 4.5],
  ]),
];
const pairHex = (n) => (n.startsWith('#') ? n : hex(n));
const checks = [
  ...PAIRS.map(([fg, bg, min]) => [fg, bg, min, contrast(pairHex(fg), pairHex(bg))]),
  ['ink', 'wash', 4.5, contrast(hex('ink'), WASH)],
  ['wash-ink-2', 'wash', 4.5, contrast(hex('wash-ink-2'), WASH)],
];
const failures = checks.filter(([, , min, r]) => r < min);
for (const [fg, bg, min, r] of failures) console.error(`contrast FAIL: ${fg} on ${bg} is ${r.toFixed(2)}, needs ${min}`);
if (failures.length) process.exit(1);

/* ---------- CSS ---------- */
const family = (key) => `'${fonts[key]}'`;
const fontQuery = `family=${fonts.ui.replace(/ /g, '+')}:wght@400;500;700&family=${fonts.mono.replace(/ /g, '+')}:wght@400;500`;
const fontLink = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontQuery}&display=swap">`;
const typeVar = (n) => {
  const s = styles[n];
  // R-28: the app loads Roboto 400, 500 and 700 only; a 600 token renders as 500 (the bold of the UI).
  const w = s.fontWeight === 600 ? 500 : s.fontWeight;
  return `  --t-${n}: ${w} ${s.fontSize}/${s.lineHeight} var(--font-${s.family});`;
};

const colourVars = json.color.tokens.map((t) => {
  const v = t.value.light;
  const alias = /^\{(.+)\}$/.exec(v);
  return `  --${t.name}: ${alias ? `var(--${alias[1]})` : v};`;
});
const hexTokens = json.color.tokens.filter((t) => /^#[0-9a-f]{6}$/i.test(hex(t.name))).map((t) => t.name);

const toneRules = TONES.map(([tone, text, soft, mark, solid]) =>
  `.t-${tone} { --tone: var(--${text}); --tone-soft: var(--${soft}); --tone-mark: var(--${mark}); --tone-solid: var(--${solid}); }`,
).join('\n');

const css = `/* =====================================================================
   VCFO Spectrum print stylesheet (A4 PDFs and printed reports).
   GENERATED by scripts/design-tokens-print.mjs from docs/design/design-tokens.json.
   Do not edit by hand: change the JSON or the script and run
     node scripts/design-tokens-print.mjs --write
   How to use it: docs/design/PRINT.md. Render with: node scripts/render-print.mjs <html> <pdf>

   Fonts (R-28). The faces come from the "type.fonts" tokens, weights 400, 500 and 700 (500 is
   the bold; 700 only for display sizes): ${fonts.ui} for every UI word and
   ${fonts.mono} for identifiers only (CIN, PAN, DIN, SRN, step codes, file paths). Put this
   link in the <head> of the page, before this stylesheet:
     ${fontLink}

   Colours are the light theme as plain hex. Status always comes with a word. The tones are the
   ones in src/components/ui/spectrum-chip.tsx: ok (Done), warn (Due soon), bad (Overdue),
   prog (In progress), idle (Not started), teal (Waiting), violet (MCA / identity), plus info
   for notes. Put .t-<tone> on any component below to colour it.
   ===================================================================== */

@page { size: A4; margin: 0; }

:root {
  /* ---- Colour tokens, light theme ---- */
${colourVars.join('\n')}

  /* ---- Type ---- */
  --font-ui: ${family('ui')}, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: ${family('mono')}, ui-monospace, SFMono-Regular, monospace;
${Object.keys(styles).map(typeVar).join('\n')}

  /* ---- Shape ---- */
  --radius: ${radius['radius-lg']};
  --radius-mark: ${radius['radius-mark']};
  --radius-bar: ${radius['radius-bar']};
  --hairline: ${border.hairline};
  --rule-width: ${border['rule-width']};
  --stat-rule: ${border['stat-rule']};
${Object.entries(space).map(([k, v]) => `  --${k}: ${v};`).join('\n')}

  /* ---- Page geometry ---- */
  --page-pad-x: 14mm;
  --page-pad-top: 14mm;
  --page-pad-bottom: 14mm;
  --gap: 5mm;
}

/* ---- Tones: .t-ok .t-warn .t-bad .t-prog .t-idle .t-teal .t-violet .t-info ---- */
${toneRules}

/* ---- Base ---- */
* { box-sizing: border-box; }
html, body {
  margin: 0;
  background: var(--surface-raised);
  color: var(--ink);
  font: 400 13.5px/1.45 var(--font-ui);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-kerning: normal;
}
b, strong { font-weight: 500; } /* R-28: 500 does the work of bold */
p { margin: 0 0 2mm; }
p:last-child { margin-bottom: 0; }
ul, ol { margin: 0; padding-left: 5mm; }
li { margin: 0.6mm 0; }
a { color: var(--brand-text); text-decoration: none; }
.mono, code, kbd, samp { font-family: var(--font-mono); font-weight: 500; font-size: 0.9em; }
.muted { color: var(--ink-muted); }
.ink-2 { color: var(--ink-2); }
.small { font-size: 12px; line-height: 16px; }
.tone-text { color: var(--tone); }
svg text { font-family: var(--font-ui); }

/* ---- Type styles (design-tokens.json "type") ---- */
h1 { font: var(--t-display-xl); font-size: 34px; line-height: 1.12; font-weight: 700; letter-spacing: -0.015em; margin: 0; }
h2 { font: var(--t-display); letter-spacing: -0.01em; margin: 0; }
h3 { font: var(--t-title); margin: 0 0 2mm; }
h4 { font: var(--t-heading); margin: 0 0 1.5mm; }
.kicker { font: var(--t-label); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-muted); }
.lead { color: var(--ink-2); margin: 1.5mm 0 0; max-width: 170mm; }
.fig { font: var(--t-figure-xl); letter-spacing: -0.015em; color: var(--tone, var(--ink)); }
.fig-lg { font: var(--t-figure-lg); letter-spacing: -0.01em; color: var(--tone, var(--ink)); }

/* ---- A4 sheet: one .page per printed page, fixed height, nothing may spill ---- */
.page {
  width: 210mm; height: 297mm;
  padding: var(--page-pad-top) var(--page-pad-x) var(--page-pad-bottom);
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; gap: var(--gap);
  break-after: page; page-break-after: always;
  background: var(--surface-raised);
}
.page:last-child { break-after: auto; page-break-after: auto; }
/* Blocks never shrink to fit: a sheet that is too full must show as overflow, not clip a card. */
.page > * { flex-shrink: 0; }
/* R-46: the regulator spectrum ribbon across the top of every sheet. */
.page::before {
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;
  background: linear-gradient(90deg,
    var(--data-3) 0 16.667%, var(--data-1) 0 33.333%, var(--data-2) 0 50%,
    var(--data-5) 0 66.667%, var(--data-4) 0 83.333%, var(--data-6) 0);
}
.foot {
  position: absolute; left: var(--page-pad-x); right: var(--page-pad-x); bottom: 6mm;
  display: flex; justify-content: space-between; gap: 6mm;
  font-size: 10px; line-height: 13px; color: var(--ink-muted);
  border-top: 1px solid var(--line-soft); padding-top: 1.6mm;
}
.foot > span:last-child { font-family: var(--font-mono); white-space: nowrap; }
/* Page head: kicker, display title, lead. A 2px rule (ink) under it, as on screen. */
.page-head { padding-bottom: 3mm; border-bottom: var(--rule-width) solid var(--rule); }
.page-head h2 { margin-top: 1mm; }

/* Flowing document (markdown and long reports): the browser breaks the pages. */
.doc { padding: 0; }
.doc h1 { font-size: 28px; margin: 0 0 2mm; }
.doc h2 { margin: 7mm 0 2.5mm; padding-bottom: 1.6mm; border-bottom: var(--rule-width) solid var(--rule); break-after: avoid; }
.doc h3 { margin: 5mm 0 2mm; break-after: avoid; }
.doc p, .doc ul, .doc ol { margin: 0 0 2.5mm; }
.doc table, .doc pre, .doc .card { margin: 0 0 3.5mm; }
.doc tr, .doc pre { break-inside: avoid; }

/* ---- Grids ---- */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
.grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
.row { display: flex; gap: 2.5mm; align-items: flex-start; }
.legend { display: flex; flex-wrap: wrap; gap: 2.5mm; align-items: center; font-size: 12px; }

/* ---- DashHero: the colour-wash cover band (one per document, on the cover) ---- */
.wash {
  background: var(--hero-gradient);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 9mm 9mm 8mm;
}
.wash .lead, .wash .kicker { color: var(--wash-ink-2); }
/* The gold underline mark of the greeting card. Marks only, never text. */
.wash .mark-gold, .mark-gold { display: block; width: 24mm; height: 3px; border-radius: 2px; background: var(--gold); margin: 3mm 0; }
/* Number tile floating on the wash. */
.wash-tile {
  background: var(--wash-tile, rgba(255, 255, 255, 0.9));
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: var(--radius);
  box-shadow: 0 8px 22px -12px rgba(10, 37, 64, 0.45);
  padding: 4mm;
}

/* ---- DashSection: the section card (surface-raised, hairline line edge, 6px corners) ---- */
.card {
  background: var(--surface-raised);
  border: var(--hairline) solid var(--line);
  border-radius: var(--radius);
  padding: 4mm;
  break-inside: avoid;
}
.card.sunken { background: var(--surface-sunken); }
.card.flush { padding: 0; overflow: hidden; }
.card-head {
  display: flex; align-items: center; gap: 2.5mm; flex-wrap: wrap;
  padding: 2.6mm 4mm; border-bottom: 1px solid var(--line-soft);
}
.card-head h3 { margin: 0; }
.card-head .meta { color: var(--ink-muted); font-size: 12px; }
.card-head .right { margin-left: auto; }
.card-body { padding: 3.5mm 4mm; }
/* StatCard: a card with a 3px top edge in its tone (put .t-<tone> on it). */
.stat { border-top: var(--stat-rule) solid var(--tone-mark, var(--line)); }
/* Navy band: the one main fill (greeting band, e-Filing table heads). */
.navy { background: var(--navy-fill); color: var(--on-navy); border-radius: var(--radius) var(--radius) 0 0; padding: 4mm 5mm; }
.navy .kicker { color: var(--side-ink); }

/* ---- Status chip (R-13): 24px, 6px corners, 7px square dot, 12px weight 500 ---- */
.chip {
  display: inline-flex; align-items: center; gap: 7px;
  height: 24px; padding: 0 9px; border-radius: var(--radius);
  font: 500 12px/16px var(--font-ui); white-space: nowrap; vertical-align: middle;
  background: var(--tone-soft, var(--upcoming-soft)); color: var(--tone, var(--upcoming));
}
.chip::before {
  content: ""; width: 7px; height: 7px; border-radius: 2px; flex: none;
  background: var(--tone-mark, var(--upcoming-mid));
}
.chip.nodot::before { display: none; }
.chip.col { min-width: 104px; }               /* in a table column: one block width */
.chip.fixed { width: 104px; overflow: hidden; }
.chip.sm { height: 20px; padding: 0 7px; font-size: 11px; gap: 5px; }
/* Solid chip: state on a solid fill with on-status text (TONE_SOLID). */
.chip.solid { background: var(--tone-solid, var(--upcoming)); color: var(--on-status); }
.chip.solid::before { background: var(--on-status); opacity: 0.85; }
/* Tag: a soft chip with no dot, for owners, people and categories (neutral by default). */
.tag {
  display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: var(--radius);
  font: 500 11px/14px var(--font-ui); white-space: nowrap; vertical-align: middle;
  background: var(--upcoming-soft); color: var(--ink-2);
}
/* A tag takes a tone only from a .t-<tone> class on itself, never from a toned parent. */
.tag[class*="t-"] { background: var(--tone-soft); color: var(--tone); }

/* ---- Marks: small solid squares carrying a glyph (tick, cross, count) ---- */
.ic {
  flex: none; display: inline-grid; place-items: center;
  width: 18px; height: 18px; border-radius: var(--radius-mark);
  background: var(--tone-solid, var(--upcoming)); color: var(--on-status);
  font: 700 11px/1 var(--font-ui);
}
.ic.lg { width: 24px; height: 24px; font-size: 14px; }

/* ---- Step marks (StepMark, R-22): done, now (ring + halo), next (solid edge) ---- */
.step {
  position: relative; z-index: 1; flex: none; display: inline-grid; place-items: center;
  width: 22px; height: 22px; border-radius: var(--radius-mark);
  background: var(--surface-raised); font: 700 11px/1 var(--font-ui); color: var(--ink-muted);
}
.step.done { background: var(--positive-mid); color: #fff; }
.step.done::after { content: "\\2713"; font-size: 13px; }
.step.now { box-shadow: inset 0 0 0 1.5px var(--tone-mark, var(--brand)), 0 0 0 4px var(--tone-soft, var(--brand-soft)); color: var(--tone, var(--brand-text)); }
.step.now:empty::after { content: ""; width: 8px; height: 8px; border-radius: 2px; background: var(--tone-mark, var(--brand)); }
.step.next { border: 1.5px solid var(--line-strong); }
/* Vertical step list with the R-58 connector drawn centre to centre behind the marks. */
.steps { position: relative; display: flex; flex-direction: column; gap: 3mm; }
.steps > .st { position: relative; padding-left: 32px; }
.steps > .st > .step { position: absolute; left: 0; top: 0; }
.steps > .st:not(:last-child)::before {
  content: ""; position: absolute; left: 10.25px; top: 11px; bottom: calc(-3mm - 11px);
  width: 1.5px; background: var(--line);
}
.steps > .st.done-link:not(:last-child)::before { background: var(--positive-mid); }
.st-title { font-weight: 500; color: var(--tone, var(--ink)); line-height: 22px; }

/* Checkbox (R-57): 16px square, 1.5px line-strong edge; done is a brand fill with a white tick. */
.check {
  flex: none; display: inline-grid; place-items: center; width: 16px; height: 16px;
  border: 1.5px solid var(--line-strong); border-radius: var(--radius-mark); background: var(--surface-raised);
  font: 700 11px/1 var(--font-ui);
}
.check.done { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.check.done::after { content: "\\2713"; }
.check.alert { border-color: var(--danger-mid); color: var(--danger); }

/* Progress bar (LeadPhaseProgress): sunken track, filled part in the tone mark. */
.bar { height: 8px; border-radius: var(--radius-bar); background: var(--upcoming-soft); overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--tone-mark, var(--brand)); border-radius: var(--radius-bar); }

/* ---- Table (DashDataTable): label heads on surface-sunken over a 2px rule, line-soft rows ---- */
table { border-collapse: collapse; width: 100%; font-size: 12.5px; line-height: 1.4; }
th {
  text-align: left; vertical-align: bottom;
  font: var(--t-label); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-muted);
  background: var(--surface-sunken); padding: 2mm 2.4mm;
  border-bottom: var(--rule-width) solid var(--rule);
}
td { padding: 1.8mm 2.4mm; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
tbody tr:nth-child(even) td { background: var(--hover); }
tbody tr:last-child td { border-bottom: 0; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.chip-cell { vertical-align: middle; white-space: nowrap; }
.card.flush > table th:first-child, .card.flush > table td:first-child { padding-left: 4mm; }
.card.flush > table th:last-child, .card.flush > table td:last-child { padding-right: 4mm; }
/* A table framed as a card. */
.table-card { border: var(--hairline) solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--surface-raised); }

/* ---- Callouts ---- */
/* Info note: info-soft ground, info-line edge. */
.callout { background: var(--info-soft); border: var(--hairline) solid var(--info-line); border-radius: var(--radius); padding: 3mm 4mm; font-size: 12.5px; }
.callout b:first-child { color: var(--info); }
/* Disclaimer: caution ground and edge, the lead words in caution text. One per page at most. */
.disclaimer {
  background: var(--caution-soft); border: var(--hairline) solid var(--caution-line); border-radius: var(--radius);
  padding: 3mm 4mm; font-size: 12px; line-height: 1.45; color: var(--ink); break-inside: avoid;
}
.disclaimer > b:first-child, .disclaimer strong { color: var(--caution); }

/* ---- Code (markdown reports) ---- */
pre {
  background: var(--surface-sunken); border: var(--hairline) solid var(--line); border-radius: var(--radius);
  padding: 3mm 4mm; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere;
  font: 500 11.5px/1.5 var(--font-mono); color: var(--ink);
}
pre code { font-size: inherit; }
:not(pre) > code { background: var(--surface-sunken); border-radius: 4px; padding: 0 3px; overflow-wrap: anywhere; color: var(--ink); }

/* ---- SVG paint helpers: class="fill-<token>" / "stroke-<token>" for every colour token ---- */
${hexTokens.map((n) => `.fill-${n} { fill: var(--${n}); }`).join('\n')}
${hexTokens.map((n) => `.stroke-${n} { stroke: var(--${n}); }`).join('\n')}
`;

if (process.argv.includes('--write')) {
  writeFileSync(out, css);
  console.log(`wrote ${path.relative(root, out)} (${checks.length} contrast pairs pass)`);
} else {
  process.stdout.write(css);
}
