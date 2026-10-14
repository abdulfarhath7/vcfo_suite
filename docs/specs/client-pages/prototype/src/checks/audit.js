// Click audit of the single-file bundle, from disk (file://).
// Every enumerated control (links, buttons, [data-go], selects, checkboxes, radios, summaries) is clicked in turn.
// A click is DEAD when neither the screen DOM, the screen path nor the hash changed afterwards.
// Usage (from src/): node checks/audit.js <desktop|mobile> <before|after> [route1,route2]
//   env: BUNDLE (default out/vcfo-client-portal-prototype-v7.html), TAG (output name), NOCLICK=1 (load sweep only)
//   output: out/checks/<TAG>-<device>-<state>.json  (dead 0, errors 0, requests 0 is a pass)
const { chromium, launchOpts } = require('./pw.js');
const fs = require('fs'), path = require('path');
const [, , device, state] = process.argv;
const FILE = 'file://' + path.resolve(process.env.BUNDLE || process.env.V6 || path.join(__dirname, '..', 'out', 'vcfo-client-portal-prototype-v7.html'));
const OUTDIR = process.env.CHECKS_OUT || path.join(__dirname, '..', 'out', 'checks'); fs.mkdirSync(OUTDIR, { recursive: true });
const OUT = path.join(OUTDIR, `${process.env.TAG || (process.argv[4] ? 'part' : 'out')}-${device}-${state}.json`);
const ENUM = `(() => {
  document.querySelectorAll('[data-audit-i]').forEach(e => e.removeAttribute('data-audit-i'));
  const sel = 'a[href],button,[role="button"],[data-go],select,input[type="checkbox"],input[type="radio"],summary,[onclick]';
  let n = 0;
  document.querySelectorAll(sel).forEach(el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || el.disabled) return;
    if (el.closest('[hidden]')) return;
    el.setAttribute('data-audit-i', String(n)); n++;
  });
  return n;
})()`;
const SNAP = `(() => {
  const s = (document.documentElement.outerHTML + '').replace(/ data-audit-i="\\d+"/g, '');
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const form = [...document.querySelectorAll('input,select,textarea,details')].map(e => (e.checked ? 1 : 0) + ':' + e.value + ':' + (e.open ? 1 : 0)).join(',');
  return h + '|' + s.length + '|' + location.hash + '|' + form;
})()`;
const LABEL = `(i) => { const el = document.querySelector('[data-audit-i="' + i + '"]'); if (!el) return ''; const t = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 48); return el.tagName.toLowerCase() + ':' + t; }`;

(async () => {
  const browser = await chromium.launch(launchOpts);
  const mobile = device === 'mobile';
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [], reqs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim().slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', r => { const u = r.url(); if (!/^(blob:|about:|data:)/.test(u) && !u.startsWith(FILE)) reqs.push(u); });
  await page.goto(FILE + '#/home');
  await page.evaluate(([d, a]) => {
    localStorage.setItem('vcfo.barHidden', 'true');
    localStorage.setItem('vcfo.device', JSON.stringify(d));
    localStorage.setItem('vcfo.after', JSON.stringify(a));
    sessionStorage.setItem('vcfo.incSeen', '1');
    localStorage.setItem('vcfo.skipIntro', '1');
  }, [mobile ? 'mobile' : 'desktop', state === 'after']);
  await page.reload();
  await page.waitForFunction(() => window.__VCFO_ROUTES && window.__pf, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const ONLY = (process.argv[4] || '').split(',').filter(Boolean);
  const keys = (await page.evaluate(() => Object.keys(window.__VCFO_ROUTES))).filter(k => !ONLY.length || ONLY.includes(k));
  const frameOf = () => page.frames().find(f => f.url().startsWith('about:srcdoc'));   // the screen frame keeps its route hash (#after, #ef_main …)
  const results = [];
  const attributed = [];
  let clicksTotal = 0, deadTotal = 0;

  for (const route of keys) {
    const le0 = errors.length, lr0 = reqs.length;
    await page.evaluate(([k, d, a]) => { localStorage.setItem('vcfo.device', JSON.stringify(d)); localStorage.setItem('vcfo.after', JSON.stringify(a)); location.hash = '#/' + k; location.reload(); }, [route, mobile ? 'mobile' : 'desktop', state === 'after']);
    await page.waitForTimeout(400);
    await page.waitForFunction(() => window.__pf && window.__pf.path && document.getElementById('stage') && document.getElementById('stage').contentDocument && document.getElementById('stage').contentDocument.readyState === 'complete', null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(900);   // the machine is loaded: wait for the screen frame, not a fixed time
    if (errors.length > le0 || reqs.length > lr0) attributed.push({ route, label: 'LOAD', errors: errors.slice(le0), requests: reqs.slice(lr0) });
    const start = await page.evaluate(() => __pf.path + __pf.hash);
    let f = frameOf(); if (!f) { results.push({ route, error: 'no frame' }); continue; }
    let n0 = 0;
    for (let t = 0; t < 6 && !n0; t++) { await page.waitForTimeout(400); f = frameOf() || f; n0 = await f.evaluate(ENUM).catch(() => 0); }
    const dead = [];
    let clicks = 0;
    for (let i = 0; i < (process.env.NOCLICK ? 0 : n0); i++) {   // NOCLICK=1: load sweep only
      try {
        f = frameOf(); if (!f) break;
        const n = await f.evaluate(ENUM);
        if (i >= n) break;
        const label = await f.evaluate((i) => { const el = document.querySelector('[data-audit-i="' + i + '"]'); if (!el) return ''; return el.tagName.toLowerCase() + ':' + (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48); }, i);
        if (!label) continue;   // the element went away before the click (the list shifted): nothing to judge
        const pBefore = await page.evaluate(() => __pf.path + __pf.hash);
        const sBefore = await f.evaluate(SNAP);
        const e0 = errors.length, r0 = reqs.length;
        const pt = await f.evaluate((i) => { const el = document.querySelector('[data-audit-i="' + i + '"]'); if (!el) return null; if (el.tagName === 'SELECT') { if (el.options.length > 1) { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } return { sel: true }; } el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, covered: !(hit === el || el.contains(hit)) }; }, i);
        if (pt && pt.sel) { /* select: answered by its change event */ }
        else if (pt && !pt.covered) { const st = await page.locator('#stage').boundingBox(); await page.mouse.click(st.x + pt.x, st.y + pt.y); }
        else await f.evaluate((i) => { const el = document.querySelector('[data-audit-i="' + i + '"]'); if (el) el.click(); }, i);
        if (errors.length > e0 || reqs.length > r0) attributed.push({ route, label, errors: errors.slice(e0), requests: reqs.slice(r0) });
        clicks++;
        // the screen may answer on its own timer (the fallback toast fires after 380 ms): poll up to 900 ms
        for (let w = 0; w < 900; w += 80) { await page.waitForTimeout(80); const pp = await page.evaluate(() => __pf.path + __pf.hash).catch(() => ''); if (pp !== pBefore) break; const ff = frameOf(); if (ff && (await ff.evaluate(SNAP).catch(() => sBefore)) !== sBefore) break; }
        const pAfter = await page.evaluate(() => __pf.path + __pf.hash);
        if (pAfter !== pBefore) {
          await page.evaluate(s => __pf.navigate(s), start);
          await page.waitForTimeout(900);
          continue;
        }
        f = frameOf(); if (!f) break;
        const sAfter = await f.evaluate(SNAP);
        if (sAfter === sBefore) dead.push({ i, label });
      } catch (e) {
        // the screen reloaded under the click (a navigation): return to the route under test
        clicks++;
        await page.evaluate(s => __pf.navigate(s), start).catch(() => {});
        await page.waitForTimeout(900);
      }
    }
    clicksTotal += clicks; deadTotal += dead.length;
    results.push({ route, controls: n0, clicks, dead });
    console.log(device, state, route, 'controls', n0, 'dead', dead.length);
  }
  fs.writeFileSync(OUT, JSON.stringify({ device, state, clicksTotal, deadTotal, errors, requests: reqs, attributed, results }, null, 1));
  console.log('DONE', device, state, 'clicks', clicksTotal, 'dead', deadTotal, 'errors', errors.length, 'requests', reqs.length);
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
