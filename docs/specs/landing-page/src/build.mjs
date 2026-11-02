// Builds the VCFO Suite landing page, and the merged landing + live prototype demo.
//
//   node docs/specs/landing-page/src/build.mjs [--prototype <path>]
//
// Always writes ../vcfo-landing-prototype.html (landing only, screenshots static).
// When the prototype file exists (flag, VCFO_PROTOTYPE, or the default path below), it also writes
// ../dist/vcfo-suite.html: the landing page with every product image opening the matching prototype
// screen full-screen. The prototype file is read, never modified. dist/ is gitignored.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const argIdx = process.argv.indexOf('--prototype');
const protoPath = (argIdx > 0 && process.argv[argIdx + 1]) || process.env.VCFO_PROTOTYPE
  || join(homedir(), 'Documents/reference/vcfo-suite/vcfo-prototype-v10.html');

function fail(msg) { console.error('build: ' + msg); process.exit(1); }
function once(hay, needle, what) {
  const n = hay.split(needle).length - 1;
  if (n !== 1) fail(`${what}: expected the anchor once, found ${n}`);
}
function patch(src, anchor, replacement, what) { once(src, anchor, what); return src.replace(anchor, () => replacement); }

const template = readFileSync(join(here, 'landing.template.html'), 'utf8');
const icons = JSON.parse(readFileSync(join(here, 'icons.json'), 'utf8'));
const svgOpen = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

// Fonts, inlined so the page works offline: Public Sans (variable, 400 to 600), IBM Plex Mono 500, Poppins 400 and 700 (the logo reveal).
const font = (file) => `url(data:font/woff2;base64,${readFileSync(join(here, 'fonts', file)).toString('base64')}) format('woff2')`;
const fontCss = '<style>'
  + `@font-face{font-family:'Public Sans';font-style:normal;font-weight:400 600;font-display:swap;src:${font('public-sans-var.woff2')}}`
  + `@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400 600;font-display:swap;src:${font('ibm-plex-mono-500.woff2')}}`
  + `@font-face{font-family:'Poppins';font-style:normal;font-weight:400;font-display:swap;src:${font('poppins-400.woff2')}}`
  + `@font-face{font-family:'Poppins';font-style:normal;font-weight:700;font-display:swap;src:${font('poppins-700.woff2')}}`
  + '</style>';

function render(demo) {
  const missing = [];
  const html = template
    .replace('{{DEMO_ATTR}}', demo ? ' data-demo="1"' : '')
    .replace('{{FONTS}}', fontCss)
    .replace(/\{\{IMG:([a-z0-9-]+)\}\}/g, (_, name) => `data:image/webp;base64,${readFileSync(join(here, 'img', `${name}.webp`)).toString('base64')}`)
    .replace(/\{\{SVG:([a-z0-9-]+)\}\}/g, (_, name) => `data:image/svg+xml;base64,${readFileSync(join(here, 'img', `${name}.svg`)).toString('base64')}`)
    .replace(/\{\{ICON:([a-z0-9-]+)\}\}/g, (_, name) => {
      if (!icons[name]) { missing.push(name); return ''; }
      return `${svgOpen}${icons[name]}</svg>`;
    });
  if (missing.length) fail('missing icons: ' + missing.join(', '));
  // The design brief bans em dashes and en dashes in page text.
  const visible = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
  if (/[–—]/.test(visible)) fail('em or en dash found in page text');
  return html;
}

const landing = render(false);
const outLanding = join(here, '..', 'vcfo-landing-prototype.html');
writeFileSync(outLanding, landing);
console.log(`Wrote ${outLanding} (${(landing.length / 1024).toFixed(0)} KB)`);

if (!existsSync(protoPath)) {
  console.log(`No prototype at ${protoPath}; skipped the merged demo. Pass --prototype <path> to build it.`);
  process.exit(0);
}

// ---------- Merged demo: landing first (paints at once), then the prototype payload and its runtime ----------
const proto = readFileSync(protoPath, 'utf8');
const pfOpen = '<script type="application/json" id="pf">';
once(proto, pfOpen, 'prototype payload');
const pfStart = proto.indexOf(pfOpen);
const pfEnd = proto.indexOf('</script>', pfStart) + '</script>'.length;
const payload = proto.slice(pfStart, pfEnd);
if (/<script|<!--/i.test(payload.slice(pfOpen.length, -9))) fail('payload contains markup that would break the script element');

const rtStart = proto.indexOf('<script>', pfEnd);
const rtEnd = proto.indexOf('</script>', rtStart);
let runtime = proto.slice(rtStart + '<script>'.length, rtEnd).replace(/\r\n/g, '\n');

// P1: do not parse 12 MB at load; parse on first use, then free the text node.
runtime = patch(runtime,
  "\n(function () {\n  var D = JSON.parse(document.getElementById('pf').textContent);",
  "\nwindow.__vcfoBoot = function () {\n  if (window.__vcfoApp) return window.__vcfoApp;\n  var pfEl = document.getElementById('pf');\n  var D = JSON.parse(pfEl.textContent); pfEl.textContent = '';",
  'P1 lazy boot');

// P3: inside each screen, Escape (when no in-screen overlay is open) closes the demo; history.back stays inside the app.
runtime = patch(runtime,
  '    var P = parent.__pf;\n    window.__VPATH = PATH;',
  `    var P = parent.__pf;
    window.__VPATH = PATH;
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var overlay = document.querySelector('.on[id^="vp-"], .vp-drill-scrim.on, .ov, .ddscrim, [aria-modal="true"], dialog[open]');
      setTimeout(function () { if (!overlay && !e.defaultPrevented) parent.postMessage({ type: 'vcfo:esc' }, '*'); }, 0);
    }, true);
    try { history.back = function () { if (window.vcfoBack) window.vcfoBack(); }; } catch (e) {}`,
  'P3 shim');

// P4: a fresh iframe per screen, so navigating inside the demo adds no browser history entries.
runtime = patch(runtime,
  '    stage.srcdoc = build(path);',
  `    var html = build(path), fresh = stage.cloneNode(false);
    fresh.removeAttribute('srcdoc'); fresh.srcdoc = html;
    fresh.addEventListener('load', onStageLoad);
    stage.parentNode.replaceChild(fresh, stage); stage = fresh;`,
  'P4 fresh iframe');
runtime = patch(runtime, "  stage.addEventListener('load', function () {", '  function onStageLoad() {', 'P4b load handler head');
runtime = patch(runtime, "  });\n\n  // first screen", "  }\n  stage.addEventListener('load', onStageLoad);\n\n  // first screen", 'P4b load handler tail');

// P5: fragment changes replace the entry instead of pushing one.
runtime = patch(runtime,
  '      try { w.location.hash = pendingHash; } catch (e) {}',
  '      try { w.location.replace(pendingHash); } catch (e) { try { w.location.hash = pendingHash; } catch (e2) {} }',
  'P5 pending hash');
runtime = patch(runtime,
  '      try { stage.contentWindow.location.hash = hash; api.hash = hash; } catch (e) {}',
  '      try { stage.contentWindow.location.replace(hash); api.hash = hash; } catch (e) { try { stage.contentWindow.location.hash = hash; api.hash = hash; } catch (e2) {} }',
  'P5 navigate hash');

// P2: no autostart; expose the API the landing's app layer drives.
runtime = patch(runtime, '  start();\n})();\n', `  function target(route) {
    if (!R[route]) route = 'home';
    var p = pathFor(route) || R.home.d, i = p.indexOf('#');
    return { path: i < 0 ? p : p.slice(0, i), hash: i < 0 ? '' : p.slice(i) };
  }
  function prep(route, o) {
    o = o || {};
    var r = R[route] || {};
    lsSet('role', o.role || r.role || 'client');
    if (o.device) lsSet('device', o.device);
    if (o.after !== undefined) lsSet('after', !!o.after); else if (route === 'home-after') lsSet('after', true);
  }
  window.__vcfoApp = {
    routes: R,
    open: function (route, o) {
      prep(route, o);
      var t = target(route);
      if (api.path !== t.path || api.hash !== t.hash || !stage.getAttribute('srcdoc')) show(t.path, t.hash);
      return t.path + t.hash;
    },
    preload: function (route) { if (api.path) return; prep(route); var t = target(route); show(t.path, t.hash); },
    navigate: navigate,
    current: function () { return api.path + api.hash; }
  };
  return window.__vcfoApp;
};
`, 'P2 export');
if (/\n  start\(\);\n/.test(runtime)) fail('start() still runs');

let merged = render(true);
once(merged, '</body>', 'landing body end');
merged = merged.replace('</body>', () => `${payload}\n<script>${runtime}</script>\n</body>`);

// Ids outside the payload must be unique (the runtime relies on #stage and #pf).
const outside = merged.slice(0, merged.indexOf(pfOpen)) + merged.slice(merged.indexOf(pfOpen) + payload.length);
const ids = [...outside.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) fail('duplicate ids: ' + [...new Set(dup)].join(', '));

const distDir = join(here, '..', 'dist');
mkdirSync(distDir, { recursive: true });
const outMerged = join(distDir, 'vcfo-suite.html');
writeFileSync(outMerged, merged);
console.log(`Wrote ${outMerged} (${(merged.length / 1048576).toFixed(1)} MB; prototype from ${protoPath})`);
