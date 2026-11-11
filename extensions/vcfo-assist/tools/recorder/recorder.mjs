// VCFO PORTAL RECORDER — captures a government portal flow that a person walks through by hand, so
// Claude can build a portal pack and a task recipe from it (docs/specs/vcfo-assist-agents/
// PORTAL-CAPTURE.md). Ported from abdulfarhath7/vcfo_assist@5e58bcf capture/recorder.js, with the
// stricter rules in README.md:
//
//  - It opens an ordinary, visible Chromium. It does not hide that the browser is driven by
//    Playwright and does not block, patch or skip any script the portal loads. If the portal
//    refuses this browser, the recorder stops and says so.
//  - No field value is stored: elements.json and events.jsonl say only whether a field is filled.
//    Saved pages lose every value attribute, inline script and query string, and PAN, Aadhaar,
//    DIN, email and phone shaped text is masked (unless --dummy-client).
//  - No screenshot of a page that shows a captcha, password or OTP box; other screenshots have
//    every form control blacked out.
//  - The network log is OFF by default. With --network it keeps method, path (no query), status
//    and content type only: no headers, no cookies, no bodies.
//  - Output and the browser profile (which holds the logged-in session) go OUTSIDE the repository,
//    to ~/vcfo-captures by default; the profile is deleted at the end unless --keep-profile.
//
// Usage:
//   CHROME_PATH=/path/to/chromium node tools/recorder/recorder.mjs <start URL> [--out DIR]
//       [--network] [--dummy-client] [--no-screenshots] [--keep-profile]
// Stop: close the browser window (or Ctrl+C).
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { elementRecord, eventRecord, networkRecord, redactHtml, stripQuery } from './redact.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const load = (name) => {
  try {
    return require(name);
  } catch {
    return require(path.resolve(here, '../../../../node_modules', name));
  }
};

// ---------- options ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const startUrl = args.find((a) => /^https?:\/\//.test(a));
if (!startUrl) {
  console.error('usage: node tools/recorder/recorder.mjs <start URL> [--out DIR] [--network] [--dummy-client] [--no-screenshots] [--keep-profile]');
  process.exit(2);
}
const OPTS = {
  network: flag('--network'),
  dummyClient: flag('--dummy-client'),
  screenshots: !flag('--no-screenshots'),
  keepProfile: flag('--keep-profile'),
};

/** The git work tree that holds `dir`, or null. Captures never go into a repository. */
function gitRootOf(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return null;
  }
}

const OUT_ROOT = path.resolve(option('--out') ?? process.env.VCFO_CAPTURES_DIR ?? path.join(homedir(), 'vcfo-captures'));
const repo = gitRootOf(OUT_ROOT);
if (repo) {
  console.error(`Refused: ${OUT_ROOT} is inside the git repository ${repo}. Captures and the logged-in browser profile must stay outside any repository. Use --out with a folder such as ~/vcfo-captures.`);
  process.exit(2);
}
const RUN_ID = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const RUN_DIR = path.join(OUT_ROOT, 'steps', RUN_ID);
const PROFILE_DIR = path.join(OUT_ROOT, `.profile-${RUN_ID}`);
mkdirSync(RUN_DIR, { recursive: true });

const log = (...a) => {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
  console.log(line);
  appendFileSync(path.join(RUN_DIR, 'recorder.log'), `${line}\n`);
};
const jsonl = (file, obj) => appendFileSync(path.join(RUN_DIR, file), `${JSON.stringify(obj)}\n`);

// ---------- in-page code ----------
// Runs in the page: the controls and their labels, never their values (only "filled or not").
const INVENTORY_JS = `(() => {
  const txt = (n) => (n && n.textContent || '').replace(/\\s+/g, ' ').trim();
  const keyOf = (el) => { const box = el.closest('.guideFieldNode'); if (!box) return undefined; return Array.from(box.classList).find((c) => !/^(guide|af-|defaultFieldLayout|mca-|validation-)/.test(c)) || undefined; };
  const labelFor = (el) => {
    let t = '';
    if (el.labels && el.labels.length) t = Array.from(el.labels).map(txt).join(' | ');
    if (!t && el.getAttribute('aria-label')) t = el.getAttribute('aria-label');
    if (!t) { const p = el.closest('.guideFieldNode, .form-group, label, td, li'); if (p) { const l = p.querySelector('label, .guideFieldLabel, legend'); t = l ? txt(l) : ''; } }
    return t.slice(0, 160);
  };
  const cssPath = (el) => { if (el.id) return '#' + CSS.escape(el.id); const parts = []; while (el && el.nodeType === 1 && el !== document.body && parts.length < 8) { let s = el.nodeName.toLowerCase(); if (el.id) { parts.unshift(s + '#' + CSS.escape(el.id)); break; } const sib = Array.from(el.parentNode ? el.parentNode.children : []).filter((c) => c.nodeName === el.nodeName); if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(el) + 1) + ')'; parts.unshift(s); el = el.parentNode; } return parts.join(' > '); };
  const out = [];
  document.querySelectorAll('input, select, textarea, button, a[href], [role=button]').forEach((el) => {
    const r = el.getBoundingClientRect();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const isButton = el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button' || ['button', 'submit', 'reset'].includes(type);
    const hasValue = el.tagName === 'SELECT' ? el.selectedIndex > 0 : (type === 'checkbox' || type === 'radio') ? el.checked : type === 'file' ? (el.files && el.files.length > 0) : Boolean(el.value);
    out.push({ tag: el.tagName.toLowerCase(), type: type || undefined, id: el.id || undefined, name: el.getAttribute('name') || undefined, key: keyOf(el),
      label: labelFor(el) || undefined, placeholder: el.getAttribute('placeholder') || undefined, ariaLabel: el.getAttribute('aria-label') || undefined,
      text: isButton ? txt(el).slice(0, 80) : undefined, isButton, hasValue: isButton ? undefined : hasValue,
      required: el.required || el.getAttribute('aria-required') === 'true' || undefined, disabled: el.disabled || undefined,
      maxlength: el.getAttribute('maxlength') || undefined, visible: r.width > 0 && r.height > 0, css: cssPath(el),
      options: el.tagName === 'SELECT' ? Array.from(el.options).slice(0, 300).map((o) => ({ v: o.value, t: o.text.trim() })) : undefined });
  });
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,legend,li.listep .text')).map(txt).filter(Boolean).slice(0, 60);
  const sensitive = Boolean(document.querySelector('input[type=password], img[src*=captcha i], img[id*=captcha i], img[alt*=captcha i], canvas, [autocomplete=one-time-code], input[name*=otp i], input[id*=otp i], input[name*=captcha i]'));
  return { title: document.title, headings, elements: out, sensitive };
})()`;

// Event hooks only: what was clicked or changed, and whether a field now holds something.
const INIT_JS = `(() => {
  const keyOf = (el) => { const box = el && el.closest && el.closest('.guideFieldNode'); if (!box) return undefined; return Array.from(box.classList).find((c) => !/^(guide|af-|defaultFieldLayout|mca-|validation-)/.test(c)) || undefined; };
  const desc = (el) => {
    if (!el || el.nodeType !== 1) return {};
    const type = (el.getAttribute('type') || '').toLowerCase();
    const isButton = el.tagName === 'BUTTON' || el.tagName === 'A' || ['button', 'submit'].includes(type);
    const lab = el.labels && el.labels[0] ? el.labels[0].textContent : '';
    return { tag: el.tagName.toLowerCase(), type: type || undefined, id: el.id || undefined, name: el.getAttribute('name') || undefined, key: keyOf(el), label: (lab || '').trim().slice(0, 80) || undefined, isButton, text: isButton ? (el.textContent || '').trim().slice(0, 60) : undefined };
  };
  const send = (kind, data) => { try { window.__vcfoRecorderEvent(JSON.stringify({ kind, ...data })); } catch (e) {} };
  let t = null;
  const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => send('mutation', {}), 900); });
  document.addEventListener('DOMContentLoaded', () => mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true }));
  document.addEventListener('click', (e) => { const b = e.target.closest ? (e.target.closest('button, a, input, select, label, [role=button]') || e.target) : e.target; send('click', { target: desc(b) }); }, true);
  document.addEventListener('change', (e) => { const el = e.target; const hasValue = el.tagName === 'SELECT' ? el.selectedIndex > 0 : (el.type === 'checkbox' || el.type === 'radio') ? el.checked : Boolean(el.value); send('change', { target: desc(el), hasValue }); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Tab') send('key', { key: e.key, target: desc(e.target) }); }, true);
})();`;

// ---------- capture ----------
let step = 0;
let lastUserAction = 0;
const lastHash = new Map();
const busy = new Map();

async function capture(page, reason) {
  const st = busy.get(page) ?? { running: false, pending: null };
  busy.set(page, st);
  if (st.running) {
    st.pending = reason;
    return;
  }
  st.running = true;
  try {
    await captureNow(page, reason);
  } catch (e) {
    log('capture error', e.message);
  }
  st.running = false;
  if (st.pending) {
    const r = st.pending;
    st.pending = null;
    setTimeout(() => capture(page, r), 300);
  }
}

async function captureNow(page, reason) {
  if (page.isClosed()) return;
  let html;
  try {
    html = await page.content();
  } catch {
    return;
  }
  const frames = [];
  for (const f of page.frames()) {
    if (f === page.mainFrame() || !f.url() || f.url() === 'about:blank') continue;
    try {
      frames.push({ url: stripQuery(f.url()), html: await f.content() });
    } catch {
      // A frame that navigates away mid-capture is skipped.
    }
  }
  const norm = (x) => x.replace(/\s(class|style|aria-[\w-]+|data-[\w-]+|tabindex|value)="[^"]*"/g, '').replace(/\s+/g, ' ');
  const hash = createHash('sha256').update(norm(html) + frames.map((f) => norm(f.html)).join('')).digest('hex');
  if (lastHash.get(page) === hash) return;
  lastHash.set(page, hash);

  step += 1;
  const id = String(step).padStart(4, '0');
  const dir = path.join(RUN_DIR, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'page.html'), redactHtml(html, OPTS));
  frames.forEach((f, i) => writeFileSync(path.join(dir, `frame-${i}.html`), `<!-- ${f.url} -->\n${redactHtml(f.html, OPTS)}`));
  let inv = null;
  try {
    inv = await page.evaluate(INVENTORY_JS);
    writeFileSync(path.join(dir, 'elements.json'), JSON.stringify({ title: inv.title, headings: inv.headings, elements: inv.elements.map((e) => elementRecord(e, OPTS)) }, null, 1));
  } catch (e) {
    log('inventory failed', e.message);
  }
  let shot = 'skipped';
  if (OPTS.screenshots && inv && !inv.sensitive) {
    try {
      // Every form control is blacked out, so nothing typed shows.
      await page.screenshot({ path: path.join(dir, 'screenshot.png'), fullPage: true, timeout: 15000, mask: [page.locator('input, select, textarea')], maskColor: '#000' });
      shot = 'masked';
    } catch {
      shot = 'failed';
    }
  } else if (inv?.sensitive) {
    shot = 'skipped: captcha, password or OTP on the page';
  }
  const meta = { step, id, ts: new Date().toISOString(), reason, url: stripQuery(page.url()), title: inv?.title ?? '', frames: frames.map((f) => f.url), elementCount: inv ? inv.elements.length : null, headings: inv ? inv.headings.slice(0, 10) : [], screenshot: shot, dummyClient: OPTS.dummyClient };
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  jsonl('events.jsonl', { kind: 'capture', ts: meta.ts, step, id, reason, url: meta.url });
  log(`step ${id} [${reason}] ${meta.url} (${meta.elementCount} controls, screenshot ${shot})`);
}

// ---------- run ----------
const { chromium } = load('playwright');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  executablePath: process.env.CHROME_PATH || undefined,
  viewport: null,
  acceptDownloads: false,
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
});
await ctx.addInitScript(INIT_JS);
await ctx.exposeBinding('__vcfoRecorderEvent', async ({ page }, raw) => {
  let ev;
  try {
    ev = JSON.parse(raw);
  } catch {
    return;
  }
  ev.ts = new Date().toISOString();
  ev.step = step;
  if (ev.kind === 'click' || ev.kind === 'change' || ev.kind === 'key') lastUserAction = Date.now();
  if (ev.kind !== 'mutation') jsonl('events.jsonl', eventRecord(ev, OPTS));
  if (['mutation', 'click', 'change'].includes(ev.kind)) setTimeout(() => capture(page, ev.kind).catch(() => {}), ev.kind === 'mutation' ? 0 : 600);
});

let stopping = false;
let timer = null;
async function stop(why) {
  if (stopping) return;
  stopping = true;
  if (why) log(why);
  clearInterval(timer);
  try {
    await ctx.close();
  } catch {
    // Already closed.
  }
  if (!OPTS.keepProfile) {
    rmSync(PROFILE_DIR, { recursive: true, force: true });
    log('browser profile (your logged-in session) deleted');
  } else {
    log(`browser profile kept at ${PROFILE_DIR}; delete it when you are done: it holds your logged-in session`);
  }
  log(`run ended at step ${step}; output in ${RUN_DIR}`);
  process.exit(0);
}

function wire(page) {
  let lastUrl = '';
  page.on('load', () => capture(page, 'load'));
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame()) return;
    const url = f.url();
    jsonl('events.jsonl', eventRecord({ kind: 'navigate', ts: new Date().toISOString(), step, url }, OPTS));
    // A portal that refuses driven browsers sends a form page straight back to its home page with
    // no click from the person. The recorder does not work around that; it stops.
    try {
      const from = new URL(lastUrl);
      const to = new URL(url);
      if (from.pathname.length > 1 && /^\/?$|\/home(\.html)?$/.test(to.pathname) && Date.now() - lastUserAction > 3000 && from.host === to.host) {
        void stop(`The portal sent this browser from ${from.pathname} back to its home page without any click. It refuses browsers driven by tools like this recorder, and the recorder does not hide itself or block the portal's scripts. Stopping. Capture this flow another way (see PORTAL-CAPTURE.md) or ask the owner.`);
        return;
      }
    } catch {
      // The first navigation has no previous URL.
    }
    lastUrl = url;
    setTimeout(() => capture(page, 'navigate'), 800);
  });
  page.on('dialog', (d) => jsonl('events.jsonl', { kind: 'dialog', ts: new Date().toISOString(), type: d.type() }));
  if (OPTS.network) {
    page.on('response', (r) => {
      const req = r.request();
      if (!['xhr', 'fetch', 'document'].includes(req.resourceType())) return;
      jsonl('network.jsonl', networkRecord({ ts: new Date().toISOString(), step, type: req.resourceType(), method: req.method(), url: r.url(), status: r.status(), contentType: r.headers()['content-type'] }));
    });
  }
}
ctx.on('page', (p) => wire(p));
const page = ctx.pages()[0] ?? (await ctx.newPage());
wire(page);
writeFileSync(path.join(RUN_DIR, 'RUN.json'), JSON.stringify({ runId: RUN_ID, startUrl: stripQuery(startUrl), options: OPTS, rules: 'tools/recorder/README.md' }, null, 1));
log(`run ${RUN_ID} started; output ${RUN_DIR}${OPTS.network ? '; network log on (paths and status only)' : ''}`);
await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch((e) => log('open failed', e.message));
await capture(page, 'start');

// A safety-net capture every five seconds catches changes with no mutation event.
timer = setInterval(() => {
  for (const p of ctx.pages()) capture(p, 'tick').catch(() => {});
}, 5000);
ctx.on('close', () => void stop('browser closed'));
process.on('SIGINT', () => void stop('stopped (Ctrl+C)'));
process.on('SIGTERM', () => void stop('stopped'));
