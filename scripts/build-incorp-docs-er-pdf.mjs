// Run: node scripts/build-incorp-docs-er-pdf.mjs (after build-incorp-docs-er.mjs)
// Prints docs/overview/incorporation-docs-er.html to an A3 landscape PDF:
// page 1 = title, steps timeline, caption and legend; page 2 = the diagram, scaled to fit.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire('/home/farhath/Documents/vcfo-suite/package.json');
const { chromium } = require('playwright');

const HTML = '/home/farhath/Documents/vcfo-suite/docs/overview/incorporation-docs-er.html';
// `--dark` prints the dark theme to incorporation-docs-er-dark.pdf; a path argument overrides the output.
const DARK = process.argv.includes('--dark');
const OUT = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'))
  ?? `/home/farhath/Documents/vcfo-suite/docs/overview/incorporation-docs-er${DARK ? '-dark' : ''}.pdf`;
const THEME = DARK ? 'dark' : 'light';

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: THEME, viewport: { width: 1600, height: 1200 } });
await page.goto('file://' + HTML, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

await page.evaluate((theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  // Caption and legend belong with the reading text on page 1; page 2 is the drawing alone.
  const section = document.querySelector('section');
  const caption = document.querySelector('figcaption');
  const legend = document.querySelector('.legend');
  const wrap = document.createElement('div');
  wrap.className = 'print-notes';
  wrap.append(caption, legend);
  section.append(wrap);
}, THEME);

await page.addStyleTag({
  content: `
    @page { size: A3 landscape; margin: 0; }
    html { color-scheme: ${THEME}; background: var(--surface); }
    body { padding: 9mm 10mm !important; background: transparent !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 16px !important; }
    header, section, figure { max-width: none !important; }
    h1 { font-size: 30px !important; }
    .lede { font-size: 16px !important; max-width: 90ch !important; }
    h2 { font-size: 14px !important; margin-top: 10px !important; }
    .controls { display: none !important; }
    .timeline { grid-template-columns: repeat(5, 1fr) !important; gap: 14px !important; }
    .step { break-inside: avoid; padding: 14px 16px 16px !important; gap: 5px !important; }
    .step-eyebrow { font-size: 12px !important; }
    .step-title { font-size: 17px !important; }
    .step-note { font-size: 14px !important; }
    .who { font-size: 12.5px !important; }
    .print-notes { margin-top: 26px; display: grid; gap: 14px; }
    .print-notes figcaption { margin: 0 !important; max-width: 110ch !important; font-size: 15px !important; }
    .legend { font-size: 15px !important; }
    figure { break-before: page; page-break-before: always; margin: 0 !important; padding-top: 9mm; }
    .scroller { overflow: visible !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; }
    .scroller svg { width: auto !important; height: 1046px !important; max-width: 100% !important; display: block; margin: 0 auto; }
  `,
});

await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log('wrote ' + OUT);
