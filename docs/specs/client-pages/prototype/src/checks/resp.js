// Responsive scan of the single-file bundle: every route x every size.
// Per page: page scroll width, elements overflowing the viewport (not inside a scrolling box), tiny text.
// Usage (from src/): node checks/resp.js <shardIndex> <shardCount> <outFile> [route1,route2] [shotsDir]
//   env: BUNDLE (default out/vcfo-client-portal-prototype-v7.html), STATES=before,after (default before)
//   a pass: every entry has hscroll false, over 0, tiny 0 (and no error)
const { chromium, launchOpts } = require('./pw.js');
const fs = require('fs'), path = require('path');
const [, , SH, SC, OUT, ONLY, SHOTS] = process.argv;
const FILE = 'file://' + path.resolve(process.env.BUNDLE || process.env.V6 || path.join(__dirname, '..', 'out', 'vcfo-client-portal-prototype-v7.html'));
const SIZES = [[360, 780], [390, 844], [430, 932], [768, 1024], [1024, 768], [1024, 1366], [1366, 1024], [1280, 720], [1280, 800], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440]];
const STATES = (process.env.STATES || 'before').split(',');
const MEASURE = `(() => {
  const W = innerWidth, H = innerHeight, de = document.documentElement;
  const sw = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const clipAnc = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { const r = a.getBoundingClientRect(); if (r.right <= W + 1 && r.left >= -1) return true; } } return false; };
  const over = [], tiny = [];
  for (const el of document.body ? document.body.querySelectorAll('*') : []) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (cs.position === 'fixed' && el.closest('#vp-launch,#vp-toast,#vp-tip')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if ((r.right > W + 2 || r.left < -2) && !clipAnc(el)) { over.push((el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (hasText && parseFloat(cs.fontSize) < 10.5 && r.right > 0 && r.left < W) tiny.push(el.tagName.toLowerCase() + ' ' + cs.fontSize + ' ' + el.textContent.trim().slice(0, 20));
  }
  return { W, H, sw, hscroll: sw > W + 1, over: over.length, overS: over.slice(0, 6), tiny: tiny.length, tinyS: tiny.slice(0, 4) };
})()`;
(async () => {
  const browser = await chromium.launch(launchOpts);
  const probe = await browser.newPage(); await probe.goto(FILE + '#/home');
  await probe.waitForFunction(() => window.__VCFO_ROUTES, null, { timeout: 60000 });
  const ALL = await probe.evaluate(() => Object.keys(window.__VCFO_ROUTES));
  // default set: every visible route plus sample step pages; named routes are scanned even when hidden (step pages)
  let routes = await probe.evaluate(() => Object.entries(window.__VCFO_ROUTES).filter(([k, r]) => !r.hide || /^inc-step-(1|6|7|8|10|12|30)$/.test(k)).map(([k]) => k));
  await probe.close();
  if (ONLY) { routes = ONLY.split(',').filter(Boolean); const bad = routes.filter(r => !ALL.includes(r)); if (bad.length) throw new Error('unknown route(s): ' + bad.join(', ')); }
  const jobs = []; for (const st of STATES) for (const s of SIZES) for (const r of routes) jobs.push([st, s, r]);
  const mine = jobs.filter((_, i) => i % +SC === +SH);
  const out = []; let ctx = null, cur = '';
  for (const [st, [w, h], route] of mine) {
    const key = st + w + 'x' + h;
    if (key !== cur) { if (ctx) await ctx.close(); const mob = w <= 1024; ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); cur = key;
      const p0 = await ctx.newPage(); await p0.goto(FILE + '#/home'); await p0.evaluate((a) => { localStorage.setItem('vcfo.barHidden', 'true'); localStorage.removeItem('vcfo.device'); localStorage.setItem('vcfo.after', JSON.stringify(a)); sessionStorage.setItem('vcfo.incSeen', '1'); sessionStorage.setItem('vcfo.introSeen', '1'); localStorage.setItem('vcfo.skipIntro', '1'); }, st === 'after'); await p0.close(); }
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    try {
      await page.goto(FILE + '#/' + route);
      // wait for the screen frame to finish loading (a loaded machine needs more than a fixed delay), then let boards render
      await page.waitForFunction(() => { const s = document.getElementById('stage'); return window.__pf && window.__pf.path && s && s.contentDocument && s.contentDocument.readyState === 'complete'; }, null, { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1100);
      const f = page.frames().find(x => x.url().startsWith('about:srcdoc'));
      const m = f ? await f.evaluate(MEASURE) : { error: 'no frame' };
      const path = await page.evaluate(() => window.__pf && window.__pf.path);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${route}__${w}x${h}__${st}.png` }); }
      out.push({ st, w, h, route, path, errs: errs.length, ...m });
    } catch (e) { out.push({ st, w, h, route, error: e.message.slice(0, 120) }); }
    await page.close();
  }
  if (ctx) await ctx.close();
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('DONE', OUT, out.length, 'fail', out.filter(o => o.error || o.hscroll || o.over || o.tiny).length);
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
