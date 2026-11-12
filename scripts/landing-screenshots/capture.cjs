// Captures the landing-page screenshots from a running local app whose database has been sanitized.
// Usage: node scripts/landing-screenshots/capture.cjs <baseUrl> <outDir> [only-name ...]
// Each shot widens the window by the sidebar's width and crops the sidebar off afterwards, so the
// app's top bar (with the firm logo) stays and every frame keeps the proportions the landing expects.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , BASE = 'http://localhost:3200', OUT = 'out', ...only] = process.argv;
const PW = 'demo1234';
const SHOTS = [
  { name: 'hero-incorporation', login: 'client-northwind@demo.vcfo.local', path: '/app/client/incorporation', w: 1200, h: 688 },
  { name: 'portal-client', login: 'client-northwind@demo.vcfo.local', path: '/app/client/overview', w: 1300, h: 745, click: ['Tree', 'Fit'] },
  { name: 'filings-client', login: 'client-solstice@demo.vcfo.local', path: '/app/client/compliances/filings', w: 1000, h: 811 },
  { name: 'calendar-client', login: 'client-northwind@demo.vcfo.local', path: '/app/client/compliances/calendar', w: 1200, h: 900, grid: true },
  { name: 'ask-vcfo', login: 'client-northwind@demo.vcfo.local', path: '/app/client/overview', w: 1200, h: 800, ask: true },
  { name: 'portal-lead', login: 'lead-divya@demo.vcfo.local', path: '/app/lead', w: 1000, h: 573 },
  { name: 'calendar-lead', login: 'lead-divya@demo.vcfo.local', path: '/app/lead/compliances/calendar', w: 1200, h: 900, grid: true },
  { name: 'portal-manager', login: 'pm-anita@demo.vcfo.local', path: '/app/manager', w: 1000, h: 573 },
  { name: 'portal-admin', login: 'admin-nadia@demo.vcfo.local', path: '/app/admin', w: 1000, h: 573 },
  { name: 'portal-super', login: 'super@vcfo.local', pw: 'super123', path: '/app/super', w: 1000, h: 573 },
];

// Overlays that are not part of the page: the intro, the Ask VCFO launcher, the dev badge, toasts.
const HIDE = `#vi, .cp-intro, .vpc-pk, #vp-tip, #ip-tt, nextjs-portal, [data-sonner-toaster], [data-nextjs-toast] { display: none !important; }
  *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; caret-color: transparent !important; }`;

async function sidebarWidth(p) {
  return p.evaluate(() => {
    const vis = [...document.querySelectorAll('aside, nav, [class*=sidebar], [class*=Sidebar]')].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.left <= 0.5 && r.width > 40 && r.width < 400 && r.height > innerHeight * 0.8 && cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    return vis.length ? Math.round(Math.max(...vis.map((el) => el.getBoundingClientRect().right))) : 0;
  });
}

const LAUNCHER = '#vp-launch, [aria-label="Open Ask VCFO"], [data-ask-launcher] { display: none !important; }';

async function settle(p, keepLauncher = false) {
  await p.waitForLoadState('networkidle').catch(() => {});
  const skip = p.locator('button:has-text("Skip")');
  if (await skip.count()) await skip.first().click().catch(() => {});
  await p.addStyleTag({ content: HIDE + (keepLauncher ? '' : LAUNCHER) });
  await p.waitForTimeout(2500);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // PW_CHROMIUM points at an installed browser when the project's Playwright has not downloaded its own.
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const sessions = new Map();
  for (const s of SHOTS) {
    if (only.length && !only.includes(s.name)) continue;
    if (!sessions.has(s.login)) {
      const ctx = await b.newContext({ viewport: { width: s.w + 248, height: s.h }, deviceScaleFactor: 2 });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      await p.fill('#email', s.login);
      await p.fill('#password', s.pw || PW);
      await p.click('form button[type=submit] >> nth=0');
      await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
      sessions.set(s.login, p);
    }
    const p = sessions.get(s.login);
    // First pass at a guess, then size the window so the content area is exactly w × h.
    await p.setViewportSize({ width: s.w + 248, height: s.h });
    await p.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
    await settle(p, !!s.ask);
    const side = await sidebarWidth(p);
    if (side !== 248) {
      await p.setViewportSize({ width: s.w + side, height: s.h });
      await p.waitForTimeout(1500);
    }
    // Buttons to press first, in order, such as the journey map's "Tree" view and its "Fit".
    for (const label of [].concat(s.click || [])) {
      await p.locator(`button:has-text("${label}")`).first().click({ timeout: 5000 }).catch((e) => console.log('click', e.message.split('\n')[0]));
      await p.waitForTimeout(1500);
    }
    await p.mouse.move(s.w + side - 2, s.h - 2); // no hover state on anything
    const file = path.join(OUT, `${s.name}.png`);
    if (s.grid) {
      // The month grid alone: the bordered card that holds the weekday header.
      const findGrid = () => {
        let el = [...document.querySelectorAll('*')].find((e) => /^mon$/i.test(e.textContent.trim()) && e.children.length === 0);
        while (el && el.parentElement) {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (r.width > 500 && r.height > 300 && cs.borderTopWidth !== '0px' && parseFloat(cs.borderRadius) > 0) break;
          el = el.parentElement;
        }
        return el;
      };
      await p.evaluate(`(${findGrid})().scrollIntoView({ block: 'center' })`);
      await p.waitForTimeout(800);
      const r = await p.evaluate(`(() => { const r = (${findGrid})().getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
      const pad = 12;
      await p.screenshot({ path: file, clip: { x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 } });
    } else if (s.ask) {
      const launch = p.locator('#vp-launch button').first();
      await launch.click({ timeout: 10000 }).catch((e) => console.log('launcher', e.message.split('\n')[0]));
      await p.addStyleTag({ content: LAUNCHER });
      await p.waitForTimeout(2500);
      const chat = p.locator('#vp-chat');
      await chat.screenshot({ path: file });
    } else {
      await p.screenshot({ path: file, clip: { x: side, y: 0, width: s.w, height: s.h } });
    }
    console.log(s.name, 'sidebar', side, '->', file);
  }
  await b.close();
})();
