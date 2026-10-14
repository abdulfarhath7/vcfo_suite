// Review screenshots of the bundle: chosen routes at chosen sizes (Before state, intro skipped).
// Usage (from src/): node checks/shots.js [route1,route2] [WxH,WxH]
//   defaults: home,incorporation,inc-step-7,credentials,documents,compliances at 390x844,1024x768,1440x900,1920x1080
//   env: BUNDLE (default out/vcfo-client-portal-prototype-v7.html), SHOTS_OUT (default out/screens), STATE=after for the After state
const { chromium, launchOpts } = require('./pw.js');
const fs = require('fs'), path = require('path');
const FILE = 'file://' + path.resolve(process.env.BUNDLE || path.join(__dirname, '..', 'out', 'vcfo-client-portal-prototype-v7.html'));
const OUT = path.resolve(process.env.SHOTS_OUT || path.join(__dirname, '..', 'out', 'screens'));
const ROUTES = (process.argv[2] || 'home,incorporation,inc-step-7,credentials,documents,compliances').split(',').filter(Boolean);
const SIZES = (process.argv[3] || '390x844,1024x768,1440x900,1920x1080').split(',').map((s) => s.split('x').map(Number));
const AFTER = process.env.STATE === 'after';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(launchOpts);
  for (const [w, h] of SIZES) {
    const mob = w <= 1024;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob });
    const p0 = await ctx.newPage(); await p0.goto(FILE + '#/home');
    await p0.evaluate((a) => { localStorage.setItem('vcfo.barHidden', 'true'); localStorage.removeItem('vcfo.device'); localStorage.setItem('vcfo.after', JSON.stringify(a)); localStorage.setItem('vcfo.skipIntro', '1'); sessionStorage.setItem('vcfo.incSeen', '1'); }, AFTER);
    await p0.close();
    for (const r of ROUTES) {
      const p = await ctx.newPage(); await p.goto(FILE + '#/' + r);
      await p.waitForFunction(() => { const s = document.getElementById('stage'); return window.__pf && s && s.contentDocument && s.contentDocument.readyState === 'complete'; }, null, { timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(1600);
      const file = path.join(OUT, `${r}__${w}x${h}${AFTER ? '__after' : ''}.png`);
      await p.screenshot({ path: file }); await p.close(); console.log(path.relative(process.cwd(), file));
    }
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
