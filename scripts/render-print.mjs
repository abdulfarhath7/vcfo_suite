// Renders an HTML page, or a markdown file, to an A4 PDF in the VCFO Spectrum print style.
//   node scripts/render-print.mjs <in.html|in.md> <out.pdf> [--shots <dir>] [--title "Footer title"]
// HTML: the page links docs/design/print-spectrum.css and lays itself out as fixed .page sheets.
//   The script waits for the fonts, checks every .page for content that spills past its bottom
//   padding or footer, and exits 1 on overflow without writing the PDF.
// Markdown: a small converter (headings, paragraphs, lists, tables, fenced code, inline code,
//   bold, italics, links and bare URLs) wraps the text in a .doc page that uses the same
//   stylesheet; the browser breaks the pages and the footer carries the page number. The script
//   fails if any element is wider than the page.
// --shots <dir> saves a PNG of each .page (HTML) or of each printed page (markdown, from the PDF
// pages as screenshots of the print layout) for review.
// Needs the playwright package and its Chromium (npx playwright install chromium).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = path.join(root, 'docs/design/print-spectrum.css');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const shots = opt('--shots');
const titleArg = opt('--title');
const [input, output] = args.map((a) => path.resolve(a));
if (!input || !output) {
  console.error('usage: node scripts/render-print.mjs <in.html|in.md> <out.pdf> [--shots <dir>] [--title "Footer title"]');
  process.exit(2);
}

/* ---------- markdown to HTML ---------- */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

export function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let para = [];
  const flush = () => { if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```\s*([\w-]*)/.exec(line);
    if (fence) {
      flush();
      const body = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]);
      i++;
      html.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { flush(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      flush();
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (/^-+:$/.test(c) ? 'num' : ''));
      const rows = [];
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(cells(lines[i]));
      const cls = (k) => (align[k] ? ` class="${align[k]}"` : '');
      html.push(`<div class="table-card"><table><thead><tr>${head.map((c, k) => `<th${cls(k)}>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c, k) => `<td${cls(k)}>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`);
      continue;
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) { items.push(m[3]); i++; continue; }
        if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flush(); html.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) { flush(); html.push(`<div class="callout">${inline(line.replace(/^>\s?/, ''))}</div>`); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flush();
  return html.join('\n');
}

function markdownPage(md, cssHref) {
  const title = /^#\s+(.*)$/m.exec(md)?.[1] ?? path.basename(input, '.md');
  const fontLink = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>/.exec(readFileSync(CSS, 'utf8'))?.[0] ?? '';
  return { title, html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
${fontLink}
<link rel="stylesheet" href="${cssHref}">
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  body { font-size: 13px; }
  .doc > h1:first-child { padding: 6mm 7mm 5mm; margin: 0 0 5mm; background: var(--hero-gradient); border: 1px solid var(--line); border-radius: var(--radius); }
  .doc table { font-size: 11.5px; margin: 0; }
  .doc .table-card { margin: 0 0 3.5mm; }
  .doc td code { font-size: 10.5px; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 4mm 0; }
</style></head>
<body><main class="doc">
${markdownToHtml(md)}
</main></body></html>` };
}

/* ---------- render ---------- */
const browser = await chromium.launch();
let tmp;
try {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  const isMd = /\.md$/i.test(input);
  let footer = titleArg;
  if (isMd) {
    tmp = path.join(path.dirname(output), `.render-${process.pid}.html`);
    const { title, html } = markdownPage(readFileSync(input, 'utf8'), pathToFileURL(CSS).href);
    footer ??= title;
    writeFileSync(tmp, html);
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  } else {
    await page.goto(pathToFileURL(input).href, { waitUntil: 'networkidle' });
  }
  await page.evaluate(() => document.fonts.ready);
  const fontsOk = await page.evaluate(() => {
    const ui = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').split(',')[0].trim();
    return { ui, loaded: document.fonts.check(`13px ${ui}`) && [...document.fonts].some((f) => f.status === 'loaded') };
  });
  if (!fontsOk.loaded) console.warn(`warning: font ${fontsOk.ui} did not load; the PDF uses a fallback face`);

  let problems = [];
  const sheets = await page.$$('.page');
  if (sheets.length) {
    // Each .page: nothing may spill past the sheet, and content must end above the footer.
    problems = await page.$$eval('.page', (ps) => ps.flatMap((p, n) => {
      const box = p.getBoundingClientRect();
      const cs = getComputedStyle(p);
      const limit = box.bottom - parseFloat(cs.paddingBottom);
      const foot = p.querySelector('.foot');
      const footTop = foot ? foot.getBoundingClientRect().top : limit;
      let worst = 0; let worstEl = '';
      for (const el of p.querySelectorAll('*')) {
        if (foot && (el === foot || foot.contains(el))) continue;
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
        const b = el.getBoundingClientRect();
        if (!b.height) continue;
        if (b.bottom > worst) { worst = b.bottom; worstEl = el.className?.baseVal ?? el.className ?? el.tagName; }
        if (b.right > box.right - 1) return [`page ${n + 1}: ${el.tagName.toLowerCase()} spills past the right edge`];
      }
      const out = [];
      if (p.scrollHeight > p.clientHeight + 1) out.push(`page ${n + 1}: scrollHeight ${p.scrollHeight} > ${p.clientHeight}`);
      if (worst > Math.min(limit, footTop - 2) + 1) out.push(`page ${n + 1}: content ends ${Math.round(worst - Math.min(limit, footTop - 2))}px below the safe area (${worstEl})`);
      return out;
    }));
    console.log(`pages: ${sheets.length}`);
  } else {
    problems = await page.$$eval('main *, body > *', (els) => {
      const w = document.documentElement.clientWidth;
      return els.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' || e.getBoundingClientRect().right > w + 1)
        .slice(0, 10).map((e) => `${e.tagName.toLowerCase()} is wider than the page: ${e.textContent.slice(0, 60)}`);
    });
  }
  if (problems.length) {
    console.error('overflow:\n  ' + problems.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('overflow: none');
    const pdfOpts = { path: output, format: 'A4', printBackground: true, preferCSSPageSize: true };
    if (!sheets.length) {
      Object.assign(pdfOpts, {
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="width:100%;margin:0 15mm;display:flex;justify-content:space-between;font:9px/1 sans-serif;color:#5e6e85"><span>${esc(footer)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      });
    }
    await page.pdf(pdfOpts);
    console.log(`wrote ${path.relative(process.cwd(), output)}`);
  }

  if (shots) {
    mkdirSync(shots, { recursive: true });
    if (sheets.length) {
      for (let n = 0; n < sheets.length; n++) await sheets[n].screenshot({ path: path.join(shots, `p${n + 1}.png`) });
    } else {
      await page.emulateMedia({ media: 'print' });
      await page.screenshot({ path: path.join(shots, 'doc.png'), fullPage: true });
    }
    console.log(`screenshots in ${shots}`);
  }
} finally {
  await browser.close();
  if (tmp) rmSync(tmp, { force: true });
}
