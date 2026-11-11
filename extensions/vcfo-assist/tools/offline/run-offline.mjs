// OFFLINE PLAYWRIGHT HARNESS (the old repository's tools/test_filler.js, ported). It fills every
// VCFO Suite MCA recipe into captured pages in a real Chromium, with no network and no extension:
//
//   CHROME_PATH=/path/to/chrome node tools/offline/run-offline.mjs [captures dir]
//   npm run offline
//
// Pages: the sanitized fixtures in tools/offline/fixtures/, plus any real captures a person has
// placed in the captures folder (argument, VCFO_CAPTURES_DIR, or ./captures; all git-ignored): the
// recorder's `<step>/page.html` with its `meta.json`, or a `*.html` carrying
// `<meta name="vcfo-capture-url" content="https://www.mca.gov.in/...">`. Each page is served under
// its real URL with every script removed; every other request is answered locally with nothing
// and logged, so the run proves no portal endpoint is called. The in-page code is the extension's
// own scanner, heal ladder (T0, T1), guards and filler (src/offline/browser-entry.ts, bundled with
// esbuild). It never clicks: a click on Submit, Pay, Send OTP or any button fails the run.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(import.meta.url);
const load = (name) => {
  try {
    return require(name);
  } catch {
    return require(path.resolve(root, '../../node_modules', name));
  }
};
const { chromium } = load('playwright');
const esbuild = load('esbuild');

const capturesDir = process.argv[2] ?? process.env.VCFO_CAPTURES_DIR ?? path.join(root, 'captures');
const bundle = (await esbuild.build({ entryPoints: [path.join(root, 'src/offline/browser-entry.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'chrome120' })).outputFiles[0].text;
const recipes = Object.values(JSON.parse(readFileSync(path.join(root, 'src/recipes/bundled.json'), 'utf8')).recipes).map((s) => s.recipe);
const profile = JSON.parse(readFileSync(path.join(here, 'sample-profile.json'), 'utf8'));

function pages() {
  const out = [];
  for (const f of readdirSync(path.join(here, 'fixtures'))) {
    const html = readFileSync(path.join(here, 'fixtures', f), 'utf8');
    out.push({ name: `fixture ${f}`, html, url: /vcfo-capture-url" content="([^"]+)"/.exec(html)?.[1], fixture: true });
  }
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = path.join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.html') && !n.startsWith('frame-')) {
        const html = readFileSync(p, 'utf8');
        const meta = path.join(path.dirname(p), 'meta.json');
        const url = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')).url : /vcfo-capture-url" content="([^"]+)"/.exec(html)?.[1];
        if (url) out.push({ name: path.relative(capturesDir, p), html, url, fixture: false });
      }
    }
  };
  if (existsSync(capturesDir)) walk(capturesDir);
  return out.filter((p) => p.url);
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
let failures = 0;
for (const page of pages()) {
  const ctx = await browser.newContext();
  const stray = [];
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.split('?')[0] === page.url.split('?')[0]) return r.fulfill({ status: 200, contentType: 'text/html', body: page.html.replace(/<script[\s\S]*?<\/script>/gi, '') });
    stray.push(u);
    return r.fulfill({ status: 204, body: '' });
  });
  const p = await ctx.newPage();
  await p.goto(page.url);
  await p.evaluate(() => {
    window.__clicks = [];
    // Radio choices are clicked to set them; a button, link or submit input never is.
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button, a, [role=button], input[type=button], input[type=submit], input[type=image]');
      if (b) window.__clicks.push((b.textContent || b.value || b.id || '').trim());
    }, true);
  });
  await p.addScriptTag({ content: bundle });
  console.log(`\n== ${page.name} (${new URL(page.url).pathname})`);
  for (const recipe of recipes) {
    const report = await p.evaluate(([r, prof]) => window.__vcfoOffline.run(r, prof), [recipe, profile]);
    if (!report) continue;
    const counts = report.rows.reduce((m, x) => ({ ...m, [x.status]: (m[x.status] ?? 0) + 1 }), {});
    console.log(`   ${report.recipeId} [${report.pages.join(', ')}] ${JSON.stringify(counts)}; refused controls: ${report.refusedControls.map((c) => `${c.code} ${c.label}`).join(' | ') || 'none'}`);
    for (const x of report.rows.filter((row) => row.status !== 'filled')) console.log(`      [${x.status}] ${x.key}${x.reason ? `: ${x.reason}` : ''}`);
    const bad = report.rows.filter((x) => x.status === 'failed' || (x.status === 'refused' && x.tier));
    if (bad.length || (page.fixture && !report.rows.some((x) => x.status === 'filled'))) {
      failures += 1;
      console.log('   FAIL: a field failed, or nothing filled on a fixture');
    }
  }
  const clicks = await p.evaluate(() => window.__clicks);
  if (clicks.length) {
    failures += 1;
    console.log(`   FAIL: something was clicked: ${clicks.join(', ')}`);
  }
  if (stray.length) console.log(`   note: ${stray.length} other request(s) answered locally with nothing (none reached a portal)`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} failure(s)` : '\noffline harness passed');
process.exit(failures ? 1 : 0);
