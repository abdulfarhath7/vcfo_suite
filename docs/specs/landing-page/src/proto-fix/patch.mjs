// Brings the clickable prototype in line with the VCFO Suite design system (book v1.2).
//
//   node docs/specs/landing-page/src/proto-fix/patch.mjs [--in <source.html>] [--out <v10.html>]
//
// Reads the bundled prototype, edits the screen files inside its payload, and writes the fixed copy.
// The source is never modified. Every targeted edit asserts its anchor, so a changed source fails loudly.
// The audit this answers is docs/specs/landing-page/PROTOTYPE-AUDIT.md (items 1 to 59).
//
// Source history: v8 (22 Oct) was the first source. On 23 Oct the owner sent "VCFO Dashboard.html",
// which is v8 plus lead additions (heatmap hover, Work status and area cards, clickable locked bars)
// and a new Manager portal (s/mgr/, routes mgr-*). It is kept as vcfo-dashboard-2026-10-23.html and is
// now the source; the output is v10. Manager screens are copies of the lead screens with a few
// additions, so every lead fix below runs on both folders.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const IN = arg('--in', join(homedir(), 'Documents/reference/vcfo-suite/vcfo-dashboard-2026-10-23.html'));
const OUT = arg('--out', join(homedir(), 'Documents/reference/vcfo-suite/vcfo-prototype-v10.html'));

function fail(msg) { console.error('patch: ' + msg); process.exit(1); }
const html = readFileSync(IN, 'utf8');
const pfOpen = '<script type="application/json" id="pf">';
const a = html.indexOf(pfOpen); if (a < 0) fail('no payload');
const b = html.indexOf('</script>', a);
const D = JSON.parse(html.slice(a + pfOpen.length, b));
const T = D.text;
const counts = {};
const bump = (file, n = 1) => { counts[file] = (counts[file] || 0) + n; };

// ---------- helpers ----------
function rep(file, old, neu, times = 1) {
  if (!(file in T)) fail(`${file}: missing`);
  const n = T[file].split(old).length - 1;
  if (n !== times) fail(`${file}: expected ${times} of ${JSON.stringify(old.slice(0, 70))}, found ${n}`);
  T[file] = T[file].split(old).join(neu); bump(file, n);
}
function repAll(file, re, fn) {
  const before = T[file]; T[file] = T[file].replace(re, fn);
  if (T[file] !== before) bump(file);
}
const isScreenish = (k) => /\.(html|js|css)$/.test(k) && !/support\.js$/.test(k) && k !== 'routes.js';
const files = Object.keys(T).filter(isScreenish);
const lead = Object.keys(T).filter((k) => /^s\/(lead|mgr)\//.test(k));
const MGR = Object.keys(T).filter((k) => /^s\/mgr\//.test(k));
if (!MGR.length) fail('no manager screens in the source');
const both = (name) => ['s/lead/' + name, 's/mgr/' + name];

// ---------- 1. Foundations: one typeface, the token palette, the radius scale ----------
for (const k of files) {
  repAll(k, /'Space Grotesk',\s*Manrope,\s*/g, '');
  repAll(k, /'Space Grotesk'|"Space Grotesk"|Space Grotesk/g, 'Public Sans');
  repAll(k, /\bManrope\b/g, 'Public Sans');
  repAll(k, /'Inter'|"Inter"|\bInter(?=\s*,\s*(?:system-ui|sans-serif|-apple-system))/g, 'Public Sans');
}
const HEX = {
  '#15805f': '#0f6e51', '#0f6b4f': '#0f6e51', '#0e8a5f': '#0f6e51',
  '#cf3a2f': '#b5302a', '#a32b22': '#b5302a', '#d0343c': '#b5302a',
  '#d9731f': '#be4400',
  '#8a99ad': '#7b8a9e', '#9aa8bb': '#7b8a9e', '#9aa6b6': '#7b8a9e',
  '#5a6b82': '#4b5b70', '#3b4b61': '#4b5b70',
  '#e4e7ec': '#e1e7ef', '#f0f2f5': '#e1e7ef', '#f3f5f8': '#e1e7ef', '#eaecf0': '#e1e7ef', '#edf0f4': '#e1e7ef',
  '#fafbfc': '#eef2f7', '#eef1f5': '#eef2f7', '#f6f8fc': '#eef2f7', '#f5f7fa': '#f7f9fc',
  '#2453c7': '#1b4f94', '#1d4ed8': '#1b4f94', '#1e40af': '#163f78',
  '#fbf3df': '#ffeedc', '#6e500f': '#9b3b08', '#ecd9a8': '#f5d3b8'
};
const hexRe = new RegExp('(' + Object.keys(HEX).join('|') + ')(?![0-9a-fA-F])', 'gi');
for (const k of files) repAll(k, hexRe, (m) => HEX[m.toLowerCase()]);
for (const k of files) {
  repAll(k, /border-radius:\s*(4|5)px(?=\s*[;"'}!])/g, 'border-radius:6px');
  repAll(k, /border-radius:\s*(7|9)px(?=\s*[;"'}!])/g, 'border-radius:8px');
  repAll(k, /border-radius:\s*11px(?=\s*[;"'}!])/g, 'border-radius:12px');
}

// ---------- 2. Copy: no em or en dashes, no emoji, sentence case, house words ----------
for (const k of files) {
  repAll(k, / — /g, ' · ');
  repAll(k, /(\w)—(\w)/g, '$1 · $2');
  repAll(k, />—</g, '>-<');
  repAll(k, /'—'/g, "'-'");
  repAll(k, / – /g, ' to ');
  repAll(k, /(\d|[A-Za-z]{3})–(\d|[A-Za-z]{3})/g, '$1-$2');
  repAll(k, /🔒\s?|⚠️?\s?|📄\s?|🤖\s?|👁️?\s?/g, '');
  repAll(k, /👍/g, 'Yes'); repAll(k, /👎/g, 'No');
  repAll(k, /\bBallin court\b/gi, (m) => (m[0] === 'B' && m[1] === 'A' ? 'BALL IN COURT' : 'Ball in court'));
  repAll(k, /\bKnowledge Bank\b/g, 'Knowledge bank');
  repAll(k, /\bBoard Resolution\b/g, 'Board resolution');
  repAll(k, /\bRegistered Office Address\b/g, 'Registered office address');
  repAll(k, /\bBank Account Opening\b/g, 'Bank account opening');
  repAll(k, /\bClient Details\b/g, 'Client details');
  repAll(k, /\bCapital Structure\b/g, 'Capital structure');
  repAll(k, /\bPre-Incorporation\b/g, 'Pre-incorporation');
  repAll(k, /\bPost-Incorporation\b/g, 'Post-incorporation');
  repAll(k, /\bFinalize\b/g, 'Finalise'); repAll(k, /\bfinalize\b/g, 'finalise');
  repAll(k, /Approve &amp; submit|Approve & submit/g, 'Approve');
}
// NEW badges: one neutral sentence-case tag (the book keeps orange for "this needs you").
for (const k of files) {
  repAll(k, /\.new\{[^}]*\}/g, '.new{font:600 10px/14px Public Sans,sans-serif;color:#4b5b70;background:#eef2f7;border:1px solid #e1e7ef;border-radius:6px;padding:1px 6px;letter-spacing:0}');
  repAll(k, /(<span class="new"[^>]*>)NEW(<\/span>)/g, '$1New$2');
  repAll(k, /<span class="new" style="background: rgba\(230,196,110,\.18\); color: #e6c46e; border-color: rgba\(230,196,110,\.4\)">/g, '<span class="new" style="background: rgba(255,255,255,.12); color: #e9eff6; border-color: rgba(255,255,255,.2)">');
}
// Lead breadcrumbs start at the page the nav calls "Today".
for (const k of lead) repAll(k, /crumb="Home ›/g, 'crumb="Today ›');

// ---------- 3. Lead sidebar: sign out where the "sun" was, Settings in the nav, neutral identity ----------
const SIDES = both('Side.dc.html');
for (const SIDE of SIDES) {
const isMgr = SIDE.startsWith('s/mgr/');
// The source already has a real Sign out button (23 Oct); the avatar becomes the neutral rounded tile.
// The Manager portal is Priya Raman's (her three leads are in its nav); the source still showed Kavya there.
rep(SIDE, `      <span style="width: 30px; height: 30px; border-radius: 99px; background: #c9a24b; color: #0f2a4a; display: grid; place-items: center; font-size: 11px; font-weight: 800; flex: none">KI</span>
      <span style="flex: 1; min-width: 0"><span style="display: block; font-size: 13px; font-weight: 700">Kavya Iyer</span><span style="display: block; font-size: 11px; color: #8fa2bb">Project Lead</span></span>`,
`      <span style="width: 30px; height: 30px; border-radius: 8px; background: rgba(255,255,255,.12); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none">${isMgr ? 'PR' : 'KI'}</span>
      <span style="flex: 1; min-width: 0"><span style="display: block; font-size: 13px; font-weight: 600">${isMgr ? 'Priya Raman' : 'Kavya Iyer'}</span><span style="display: block; font-size: 11px; color: #9fb0c6">${isMgr ? 'Project manager' : 'Project lead'}</span></span>`);
if (!T[SIDE].includes('data-signout')) fail(SIDE + ': sign-out button missing');
rep(SIDE, "    items.push(['analytics', 'Analytics'], ['audit', 'Audit']);", "    items.push(['analytics', 'Analytics'], ['audit', 'Audit'], ['settings', 'Settings']);");
rep(SIDE, "      audit: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M12 7v5l4 2'\n",
  "      audit: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M12 7v5l4 2',\n      settings: 'M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'\n");
// Nav: badges neutral (red only means overdue), NEW neutral, active icon takes its label's colour, parent stays neutral when a child is active.
rep(SIDE, "(bk === 'r' ? 'background:#b5302a;color:#fff' : 'background:rgba(255,255,255,.12);color:#fff')", "'background:rgba(255,255,255,.12);color:#fff'");
repAll(SIDE, /<span style="font: 700 9px 'IBM Plex Mono', monospace; letter-spacing: \.06em; color: #0f2a4a; background: #e6c46e; border-radius: 3px; padding: 1px 4px">NEW<\/span>/,
  '<span style="font: 600 10px Public Sans, sans-serif; color: #e9eff6; background: rgba(255,255,255,.12); border-radius: 6px; padding: 1px 6px">New</span>');
rep(SIDE, "        ic: 'display:flex;' + (on ? 'color:#e6c46e' : ''),", "        ic: 'display:flex;',");
rep(SIDE, "(on ? 'background:rgba(255,255,255,.1);color:#fff;font-weight:700;box-shadow:inset 3px 0 0 #c9a24b,inset 0 0 0 1px rgba(120,160,230,.35)' : 'color:#b8c4d4;font-weight:500')",
  "(on && !sub ? 'background:#1d3d64;color:#fff;font-weight:600;box-shadow:inset 3px 0 0 #c9a24b' : (on ? 'color:#fff;font-weight:600' : 'color:#b8c4d4;font-weight:500'))");
rep(SIDE, "(on && l === sub ? 'color:#fff;font-weight:700;background:rgba(255,255,255,.08)' : 'color:#9fb0c6')", "(on && l === sub ? 'color:#fff;font-weight:600;background:#1d3d64;box-shadow:inset 3px 0 0 #c9a24b' : 'color:#9fb0c6')");
// Phase tags, manager avatars, gold labels and the gold today cell go neutral; company dots keep their colour.
rep(SIDE, `"font:600 9.5px 'IBM Plex Mono',monospace;letter-spacing:.04em;padding:1px 4px;border-radius:3px;" + (p === 'inc' ? 'background:rgba(230,196,110,.18);color:#e6c46e' : 'background:rgba(47,211,160,.15);color:#7fe3c2')`,
  `"font:600 10px Public Sans,sans-serif;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.1);color:#c9d6e8"`);
rep(SIDE, "phase: p === 'inc' ? 'INC' : 'CMP',", "phase: p === 'inc' ? 'Inc' : 'Cmp',");
rep(SIDE, "[['Priya Raman', 'PR', 'Engagement manager', '#7fe3c2'], ['Arjun Mehta', 'AM', 'Compliance manager', '#9ec5ff']]", "[['Priya Raman', 'PR', 'Project manager', ''], ['Arjun Mehta', 'AM', 'Project lead', '']]");
rep(SIDE, "av: 'width:26px;height:26px;border-radius:99px;flex:none;display:grid;place-items:center;font-size:10px;font-weight:800;color:#0f2a4a;background:' + c }));",
  "av: 'width:26px;height:26px;border-radius:8px;flex:none;display:grid;place-items:center;font-size:10px;font-weight:600;color:#fff;background:rgba(255,255,255,.12)' }));");
rep(SIDE, 'color: #c9a24b; margin-bottom: 8px">Your managers', 'color: #9fb0c6; margin-bottom: 8px">Your managers');
rep(SIDE, 'font-size: 12px; font-weight: 600; color: #e6c46e">View all 8', 'font-size: 12px; font-weight: 600; color: #e9eff6">View all 8');
rep(SIDE, "(d === 16 ? 'background:#c9a24b;color:#0f2a4a;font-weight:700'", "(d === 16 ? 'background:#1d3d64;color:#fff;font-weight:600;box-shadow:inset 0 0 0 1px #6aa2e8'");
rep(SIDE, `font: 500 10px 'IBM Plex Mono', monospace; text-align: center`, 'font: 500 10px Public Sans, sans-serif; text-align: center');
}

const TODAYS = [...both('Main.dc.html'), ...both('TodayBefore.dc.html'), ...both('TodayAfter.dc.html')];
// ---------- 4. Lead Today (three variants): one table look, state colours, no cards inside cards ----------
for (const k of TODAYS) {
  // Action queue: a head row and one hairline row per company, exactly like Phase progress.
  const HM = /<div style="overflow-x: auto"><div style="display: grid; grid-template-columns: 200px repeat\(5, minmax\(64px, 1fr\)\) 80px; gap: 4px; align-items: center; padding: 2px 16px 14px; min-width: 640px">\s*<span><\/span><sc-for list="\{\{hmCols\}\}" as="c" hint-placeholder-count="5"><span style="\{\{c\.st\}\}">\{\{c\.l\}\}<\/span><\/sc-for><span style="[^"]*">Total<\/span>\s*<sc-for list="\{\{hm\}\}" as="r" hint-placeholder-count="8">([\s\S]*?)<\/sc-for>\s*<\/div><\/div>/;
  if (!HM.test(T[k])) fail(k + ': action queue grid');
  const cols = 'display: grid; grid-template-columns: 200px repeat(5, minmax(64px, 1fr)) 80px; gap: 4px; align-items: center; padding: 4px 16px';
  T[k] = T[k].replace(HM, (m, row) => `<div style="overflow-x: auto"><div class="ds-rows" style="min-width: 640px; margin-bottom: 8px">
              <div class="ds-head" style="${cols}; padding-top: 8px; padding-bottom: 8px"><span>Company</span><sc-for list="{{hmCols}}" as="c" hint-placeholder-count="5"><span style="text-align: center">{{c.l}}</span></sc-for><span style="text-align: center">Total</span></div>
              <sc-for list="{{hm}}" as="r" hint-placeholder-count="8"><div class="ds-row" style="${cols}; min-height: 40px">${row}</div></sc-for>
            </div></div>`); bump(k);
  // In progress is the brand blue (it was navy, the colour of ink).
  rep(k, "['gold', 'mine', 'My step', '#0f2a4a']", "['gold', 'mine', 'My step', '#1b4f94']");
  // Phase progress: the same head and 40px rows.
  repAll(k, /<div class="mono" style="display: grid; grid-template-columns: 200px 1fr 80px; gap: 16px; padding: 6px 16px; font-size: 10px; color: #7b8a9e; letter-spacing: \.06em; background: #eef2f7; border-top: 1px solid #e1e7ef">/g,
    '<div class="ds-head" style="display: grid; grid-template-columns: 200px 1fr 80px; gap: 16px; padding: 8px 16px">');
  repAll(k, /<div style="display: grid; grid-template-columns: 200px 1fr 80px; gap: 16px; align-items: center; padding: 9px 16px; border-top: 1px solid #e1e7ef">/g,
    '<div class="ds-row" style="display: grid; grid-template-columns: 200px 1fr 80px; gap: 16px; align-items: center; min-height: 40px; padding: 4px 16px; border-top: 1px solid #e1e7ef">');
  repAll(k, /S = \{ d: 'background:#0f6e51;color:#fff', c: 'background:#0f2a4a;color:#fff;box-shadow:0 0 0 3px rgba\(201,162,75,\.55\)'/g, "S = { d: 'background:#0f6e51;color:#fff', c: 'background:#1b4f94;color:#fff'");
  // Clients x filings: cells keep their state fill, rows gain the hairline and the table head.
  rep(k, '.fg{width:100%;border-collapse:separate;border-spacing:3px;min-width:700px}',
    '.fg{width:100%;border-collapse:collapse;min-width:700px}.fg thead th{background:#eef2f7;border-bottom:2px solid #0f2a4a;padding:8px 3px}.fg thead th:first-child,.fg tbody td:first-child{padding-left:16px}.fg thead th:last-child,.fg tbody td:last-child{padding-right:16px}.fg tbody td{border-top:1px solid #e1e7ef;padding:6px 3px}');
  repAll(k, /<div style="overflow-x: auto; padding: 0 13px 14px">(\s*<table class="fg">)/g, '<div style="overflow-x: auto; padding: 0 0 10px">$1');
  rep(k, '.fg td{height:30px;border-radius:6px;text-align:center;font-size:10.5px;font-weight:700}', '.fg td{text-align:center;font-size:12px;font-weight:600}.fg tbody td>span.fc{display:grid;place-items:center;height:28px;border-radius:6px}');
  repAll(k, /<td style="\{\{c\.st\}\}" title="\{\{c\.tip\}\}">\{\{c\.t\}\}<\/td>/g, '<td title="{{c.tip}}"><span class="fc" style="{{c.st}}">{{c.t}}</span></td>');
  if (!T[k].includes('<span class="fc" style="{{c.st}}">{{c.t}}</span>')) fail(k + ': filings cell span');
  // Phase cells follow their legend: done green, current brand blue, stuck red, next dashed.
  rep(k, "st: 'height:32px;border-radius:6px;display:grid;place-items:center;font:700 12px Public Sans,sans-serif;' + (doneP ? 'background:#0f6e51;color:#fff' : (started ? 'background:#be4400;color:#ffffff' : 'background:#e6eaf0;color:#7b8a9e')) };",
    "st: 'height:28px;border-radius:6px;display:grid;place-items:center;font:600 12px Public Sans,sans-serif;' + (doneP ? 'background:#0f6e51;color:#fff' : (k2 === 's' ? 'background:#b5302a;color:#fff' : (k2 === 'c' ? 'background:#1b4f94;color:#fff' : 'background:#fff;border:1.5px dashed #a8b4c4;color:#7b8a9e'))) };");
  repAll(k, /Done ✓ · Current navy · Stuck red · Next dashed/g, 'Done ✓ · Current blue · Stuck red · Next dashed');
  // Owner chips are soft tints: the lead's own work is the firm (SBC blue), the client is orange.
  repAll(k, /Me: 'background:#0f2a4a;color:#fff', Client: 'background:#e3eefb;color:#1a5fb4'/g, "Me: 'background:#e5f4ff;color:#0a4f94', Client: 'background:#ffeedc;color:#9b3b08'");
  // One primary per region: Triage rows get secondary buttons at the 28px row height.
  repAll(k, /class="btn btnp" style="height: 26px; font-size: 11\.5px">Make task/g, 'class="btn" style="height: 28px; font-size: 12px">Make task');
  repAll(k, /class="btn" style="height: 26px; font-size: 11\.5px">(Done|Snooze)/g, 'class="btn" style="height: 28px; font-size: 12px">$1');
  // Ball in court: three columns split by hairlines instead of three cards inside the card.
  repAll(k, /<div style="border: 1px solid #e1e7ef; border-radius: 8px; padding: 10px 12px; background: #fff">/g, '<div style="border-left: 1px solid #e1e7ef; padding: 2px 14px">');
}

// ---------- 5. Structure: identity is neutral, no coloured left edges, no gold stubs, one gradient ----------
// Each client keeps one colour across every lead screen (owner's decision, 22 Oct 2026): the lead
// recognises a company by its colour. Today used grey for all eight; it now uses the same set as Work.
const CO = { BR: ['#db2777', '#fde2ec', '#9d174d'], TL: ['#0d9488', '#ccf3ec', '#0f5f55'], KH: ['#0284c7', '#dbeefe', '#0b5c8f'], HF: ['#a16207', '#fdf0d2', '#8a5a06'],
  NT: ['#7c3aed', '#ebe5ff', '#5b21b6'], OL: ['#4f46e5', '#e3e9ff', '#3730a3'], LA: ['#16a34a', '#daf5e3', '#166534'], JB: ['#64748b', '#eef1f5', '#334155'] };
for (const k of TODAYS) {
  repAll(k, /(\s)(BR|TL|KH|HF|NT|OL|LA|JB): \['([^']+)', '#7b8a9e', '#eef2f7', '#4b5b70', '(inc|cmp)'\]/g, (m, sp, key, name, ph) => `${sp}${key}: ['${name}', '${CO[key][0]}', '${CO[key][1]}', '${CO[key][2]}', '${ph}']`);
  if (!T[k].includes("NT: ['Northwind Technologies', '#7c3aed'")) fail(k + ': company colours');
}
// Coloured left edges become nothing; the sidebar's active rail is the one left mark, gold on both portals.
for (const k of files) {
  if (SIDES.includes(k) || k === 'shell.js') continue;
  repAll(k, /inset [2-4]px 0 0 ' \+ \([^)]*\) \+ '/g, "0 0 0 0 transparent");
  repAll(k, /inset [2-4]px 0 0 ' \+ [A-Za-z_.\[\]0-9]+ \+ '/g, "0 0 0 0 transparent");
  repAll(k, /inset [34]px 0 0 (?:#[0-9a-fA-F]{6}|var\(--[a-z-]+\)|oklch\([^)]*\))/g, '0 0 0 0 transparent');
  repAll(k, /border-left:\s*3px solid var\(--[a-z-]+\)/g, 'border-left:1px solid var(--border)');
  // the short gold stub drawn on top of client and lead cards
  repAll(k, /::before\{content:"";(position:absolute;left:\d+px;top:-1px;width:\d+px;height:3px)/g, '::before{content:none;$1');
}
rep('shell.js', 'inset 3px 0 0 #6e96ff', 'inset 3px 0 0 #c9a24b');
// One gradient, the greeting card: the client page and step headers become flat navy.
for (const k of both('Overview.dc.html')) repAll(k, /linear-gradient\(115deg, #0f2a4a 0%, #17396b 60%, #1b4f94 100%\)/g, '#0f2a4a');
for (const k of both('Step.dc.html')) repAll(k, /linear-gradient\(115deg, ?#0f2a4a, ?#1b4f94\)/g, '#0f2a4a');
for (const k of lead) repAll(k, /linear-gradient\(135deg,#c9a24b,#1b4f94\)/g, '#1d3d64');

// ---------- 6. Data and dates: one client contact, real dates for statutory deadlines ----------
for (const k of files) {
  repAll(k, /Rahul Khanna/g, 'Rohan Kumar');
  repAll(k, /rahul@northwind\.in/g, 'rohan@northwind.in');
}
for (const k of both('Palette.dc.html')) rep(k, 'TDS challan due in 5 days', 'TDS challan due 7 Nov');
for (const k of both('Notifications.dc.html')) rep(k, 'GSTR-1 due in 3 days', 'GSTR-1 due 11 Oct');
rep('s/team/notif_redesign.dc.html', 'GSTR-1 due in 3 days', 'GSTR-1 due 11 Oct');
for (const k of both('Announcements.dc.html')) rep(k, 'Next deadline · in 12 days', 'Next deadline · 20 Oct');
rep('s/team/ann_redesign.dc.html', 'Next deadline · in 12 days', 'Next deadline · 20 Oct');
for (const k of ['s/home/v7x_timeline_options.dc.html', 's/home/v7p_step.dc.html']) rep(k, 'Due 9 Oct 2026, in 3 days.', 'Due 9 Oct 2026.');
rep('s/comp/index.html', '`<span style="color:var(--muted)">in ${daysLeft(r.due)} days</span>`', '`<span style="color:var(--muted)">Not filed yet</span>`');
rep('s/comp/index.html', '2 filings · in 7 days', '2 filings · due this week');
rep('s/comp/index.html', "['3','Due in 7 days','--due']", "['3','Due this week','--due']");
rep('s/comp/index.html', "'due in 7 days'", "'due this week'");
rep('s/comp/index.html', '${I.clock(11)} 12 days left', '${I.clock(11)} Due 20 Oct');
rep('s/comp/index.html', 'data-tip="GSTR-1 · 3 of 7 days left"', 'data-tip="GSTR-1 · due 11 Oct"');
rep('s/docs/lib_reader.dc.html', '>24 days left', '>30-day window');
for (const k of [...both('Filings.dc.html'), ...both('CompCal.dc.html')]) repAll(k, /Due within 7 days/g, 'Due this week');

// ---------- 7. Lead pages: Vault edges, Filings dates, Settings ----------
for (const k of both('Vault.dc.html')) rep(k, "band: 'align-self:stretch;background:' + (ext === 'PDF' ? '#b5302a' : (ext === 'DOCX' ? '#1b4f94' : '#0f6e51')) });", "band: 'align-self:stretch;background:transparent' });");
for (const k of both('Filings.dc.html')) repAll(k, /<td><span style="color:var\(--muted\)">in \d+ days<\/span><\/td>/g, '<td><span style="color:var(--muted)">Not filed yet</span></td>');
for (const k of both('Settings.dc.html')) {
  rep(k, 'class="btn" style="margin-left: auto; color: #b5302a">Sign out', 'class="btn" data-signout style="margin-left: auto">Sign out');
  repAll(k, /border-radius: 99px; background: #c9a24b; color: #0f2a4a;/g, 'border-radius: 12px; background: #eef2f7; color: #0f2a4a;');
}

// ---------- 8. Lead pages lose their page title (the breadcrumb and the nav already name the page) ----------
for (const k of both('Settings.dc.html')) rep(k, '      <div style="display: flex; align-items: center; gap: 10px"><h1 class="sg" style="margin: 0; font-size: 22px; font-weight: 600">Settings</h1><button type="button" class="btn" data-signout style="margin-left: auto">Sign out</button></div>\n', '');
for (const k of ['Work', 'WorkBoard', 'Vault', 'Knowledge', 'Email', 'Analytics', 'Clients', 'Documents', 'BoardRes', 'Step'].flatMap((n) => both(n + '.dc.html'))) {
  repAll(k, /\n\s*<div><div style="font-size: 10\.5px;[^\n]*?<\/h1><\/div>/, '');
  repAll(k, /\n\s*<span style="width: 32px; height: 32px; border-radius: 8px; background: #[0-9a-f]{6}; color: #[0-9a-f]{6}; display: grid; place-items: center">[\s\S]*?<\/span>(?=\n\s*<h1)/, '');
  repAll(k, /\n\s*<h1 class="sg" style="margin: 0; font-size: 22px; font-weight: 600">[^<]*<\/h1>/, '');
  repAll(k, /\n\s*<a href="#" aria-label="Back" style="color: #[0-9a-f]{6}; font-size: 22px">‹<\/a>/, '');
  repAll(k, /<span style="margin-left: auto; display: inline-flex; padding: 2px;/g, '<span style="display: inline-flex; padding: 2px;');
  if (/<h1 class="sg"/.test(T[k])) fail(k + ': page title still present');
}
for (const k of both('Vault.dc.html')) rep(k, '<span style="display: flex; gap: 20px; margin-left: 12px">', '<span style="display: flex; gap: 20px">');
for (const k of both('Knowledge.dc.html')) rep(k, 'class="mut" style="font-size: 12.5px; margin-left: 8px">All ›', 'class="mut" style="font-size: 12.5px">All ›');
for (const k of both('Email.dc.html')) repAll(k, /(<span class="chip" style="background: #[0-9a-f]{6}; color: #[0-9a-f]{6}); margin-left: auto">/, '$1">');

// ---------- 10. Manager portal (new on 23 Oct): Priya Raman, her three leads, the same rules as lead ----------
// Persona: the manager screens were copied from the lead and still greeted Kavya. Priya Raman is the
// project manager in the lead sidebar, and the manager's nav lists her leads, so the portal is hers.
for (const k of MGR) {
  repAll(k, /kavya\.iyer@/g, 'priya.raman@');
  repAll(k, /Kavya Iyer/g, 'Priya Raman');
  repAll(k, /\bKavya\b/g, 'Priya');
  repAll(k, /My Leads/g, 'My leads');
}
{
  const S = 's/mgr/Side.dc.html';
  // A manager has no "Your managers" block; her leads are already under My leads in the nav.
  repAll(S, /\n    <div style="border-top: 1px solid rgba\(255,255,255,\.1\); padding-top: 12px">\s*<div style="[^"]*">Your managers<\/div>[\s\S]*?<\/sc-for>\s*<\/div>/, '');
  if (/Your managers/.test(T[S])) fail(S + ': managers block still present');
  // Leads are people: neutral rounded tiles, counts in sans, no gold link.
  rep(S, "av: 'width:18px;height:18px;border-radius:99px;flex:none;display:grid;place-items:center;font-size:8.5px;font-weight:800;color:#0f2a4a;background:' + c,",
    "av: 'width:20px;height:20px;border-radius:6px;flex:none;display:grid;place-items:center;font-size:9px;font-weight:600;color:#fff;background:rgba(255,255,255,.12)',");
  rep(S, `ps: "font:600 9.5px 'IBM Plex Mono',monospace;letter-spacing:.04em;padding:1px 4px;border-radius:3px;background:rgba(255,255,255,.1);color:#c9d6e8" }));`,
    `ps: "font:600 10px Public Sans,sans-serif;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.1);color:#c9d6e8" }));`);
  // No "All 3 leads" link: the three leads are already listed right above it (owner, 23 Oct).
  repAll(S, /\n\s*<a href="#" style="[^"]*">All 3 leads<\/a>/, '');
  if (/All 3 leads/.test(T[S])) fail(S + ': All 3 leads link still present');
}
rep('proto.js', "[/^My Leads|^All 3 leads|^(Sneha|Meera|Rohan) /, 'lead-leads']", "[/^My [Ll]eads|^All 3 leads|^(Sneha|Meera|Rohan) /, 'lead-leads']");
{
  // Manager Today, team tasks: client tiles in the client's colour, people as neutral rounded tiles,
  // and the status column as solid state chips (the table look comes from ds.css).
  const M = 's/mgr/Main.dc.html';
  rep(M, "coAv: 'width:22px;height:22px;border-radius:6px;flex:none;display:inline-grid;place-items:center;font-size:10px;font-weight:800;background:#f7f9fc;border:1px solid #e1e7ef;color:#4b5b70',",
    "coAv: 'width:22px;height:22px;border-radius:6px;flex:none;display:inline-grid;place-items:center;font-size:10px;font-weight:600;background:' + CL[r.k][2] + ';color:' + CL[r.k][3],");
  rep(M, "const mtAv = (bg, fg) => 'width:24px;height:24px;border-radius:99px;flex:none;display:inline-grid;place-items:center;font-size:10px;font-weight:800;background:' + bg + ';color:' + fg;",
    "const mtAv = (bg, fg) => 'width:24px;height:24px;border-radius:8px;flex:none;display:inline-grid;place-items:center;font-size:10px;font-weight:600;background:' + bg + ';color:' + fg;");
  rep(M, "cs: 'color:' + MT_ST[r.st][1] + ';background:' + MT_ST[r.st][2] + ';min-width:116px;justify-content:center' }));",
    "cs: 'color:#fff;background:' + (r.st === 'none' ? '#656f7e' : MT_ST[r.st][1]) + ';min-width:116px;justify-content:center' }));");
}
{
  // My leads: the page opens on the lead picker (no title); picker buttons are 8px rectangles; leads are neutral tiles.
  const L = 's/mgr/Leads.dc.html';
  rep(L, '        <h1 class="sg" style="margin: 0; font-size: 22px; font-weight: 600">My leads</h1>\n', '');
  rep(L, '.ld-btn{display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 14px 0 6px;border-radius:99px;', '.ld-btn{display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 14px 0 6px;border-radius:8px;');
  rep(L, "av: 'width:32px;height:32px;border-radius:99px;flex:none;display:grid;place-items:center;font-size:11px;font-weight:800;color:#0f2a4a;background:' + x.c,",
    "av: 'width:32px;height:32px;border-radius:8px;flex:none;display:grid;place-items:center;font-size:11px;font-weight:600;color:#0f2a4a;background:#eef2f7',");
}
for (const k of lead) {
  // Assignee bubbles and pickers: people are rounded tiles, not circles.
  repAll(k, /(const asgAv = \(on\) => 'width:22px;height:22px;border-radius:)99px/g, '$18px');
  repAll(k, /(it\.asgSt = 'width:24px;height:24px;border-radius:)99px/g, '$18px');
  // "Plan my week" was an orange outlined button; it is a secondary button like its neighbours.
  repAll(k, / style="border-color: #c9a24b; background: #ffeedc; color: #9b3b08"(?=><svg)/g, '');
  // No gold underline under the greeting card.
  repAll(k, /background: linear-gradient\(90deg, #c9a24b, rgba\(201,162,75,0\) 70%\)/g, 'background: transparent');
}

// ---------- 11. Layout fixes for what the 23 Oct source added ----------
// Client health: the source sizes its columns with a <colgroup>, which the screen template drops, so all
// five columns came out equal and the progress bar shrank under its label. The widths move to the heads.
for (const k of TODAYS) rep(k, '.tbl.hl{min-width:0;table-layout:fixed}',
  '.tbl.hl{min-width:0;table-layout:fixed}.tbl.hl th:nth-child(1){width:27%}.tbl.hl th:nth-child(2){width:15%}.tbl.hl th:nth-child(3){width:34%}.tbl.hl th:nth-child(4),.tbl.hl th:nth-child(5){width:12%}');
// Work timeline: the label column narrowed to 170px, so the second line wrapped into the next row. It truncates.
for (const k of [...both('Work.dc.html'), 's/mgr/Leads.dc.html']) {
  rep(k, '<span style="min-width: 0"><b style="display: block; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{r.t}}</b><span class="mut" style="font-size: 10.5px">{{r.c}}</span></span>',
    '<span style="min-width: 0; overflow: hidden"><b style="display: block; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{r.t}}</b><span class="mut" style="display: block; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis" title="{{r.c}}">{{r.c}}</span></span>');
}
// "Plan Sneha 's week" rendered with a gap where the name meets the apostrophe.
rep('s/mgr/Leads.dc.html', 'Plan {{ldFirst}}’s week', 'Plan the week');

// ---------- 12. Client home: the timeline and the steps come first in the main column (owner, 23 Oct) ----------
{
  const card = (name) => new RegExp('<div style="animation-delay:[\\d.]+s"><dc-import name="' + name + '"[^>]*></dc-import></div>');
  for (const [k, area, names] of [['s/home/v7_before.dc.html', 'a', ['v7c_timeline_b', 'v7c_steps_b']], ['s/home/v7_after.dc.html', 'a1', ['v7c_timeline_a', 'v7c_steps_a']]]) {
    const moved = names.map((n) => { const m = T[k].match(card(n)); if (!m) fail(k + ': ' + n); T[k] = T[k].replace(m[0], ''); return m[0]; });
    // A full-width row of its own under the greeting (area t), so the two columns below stay balanced
    // (owner, 23 Oct: putting them at the top of the left column left the right side empty).
    rep(k, `<div class="stag" style="grid-area:${area}">`, `<div class="stag" style="grid-area:t">${moved.join('')}</div><div class="stag" style="grid-area:${area}">`);
  }
  const GRID = `<style>/* client home: the timeline row (t) under the greeting, added by proto-fix/patch.mjs */
.vh-b{grid-template-areas:"g" "t" "a" "c1" "b" "c2"}
.vh-a{grid-template-areas:"g" "t" "a1" "c1" "a2" "c2" "f" "d" "e"}
@media (min-width:600px){.vh-b{grid-template-areas:"g g" "t t" "a a" "c1 c2" "b b"}.vh-a{grid-template-areas:"g g" "t t" "a1 a1" "c1 a2" "c1 c2" "f f" "d e";grid-template-rows:auto auto auto auto 1fr}}
@media (min-width:1180px){.vh-b{grid-template-areas:"g g" "t t" "a c1" "a c2" "b c2";grid-template-rows:auto auto auto 1fr auto}.vh-a{grid-template-areas:"g g g g g g" "t t t t t t" "a1 a1 a1 a1 c1 c1" "a1 a1 a1 a1 c2 c2" "a2 a2 a2 a2 c2 c2" "f f f f f f" "d d d e e e";grid-template-rows:auto auto auto 1fr auto}}
@media (min-width:1800px){.vh-b{grid-template-areas:"g g g" "t t t" "a c1 c2" "b b c2";grid-template-rows:auto auto auto 1fr}.vh-a{grid-template-areas:"g g g g g g" "t t t t t t" "a1 a1 a2 a2 c1 c1" "a1 a1 c2 c2 c1 c1" "f f f f f f" "d d d e e e";grid-template-rows:auto auto auto 1fr}}
</style>`;
  for (const k of ['s/home/v7_before.dc.html', 's/home/v7_after.dc.html']) {
    const i = T[k].indexOf('<main class="vh-main'); if (i < 0) fail(k + ': main');
    T[k] = T[k].slice(0, i) + GRID + T[k].slice(i); bump(k);
  }
}

// ---------- 13. My leads: the sidebar picks the lead; the page opens on that lead's name and clients ----------
{
  const L = 's/mgr/Leads.dc.html';
  // The picker repeated the sidebar's lead list. It goes; the lead's name, counts and actions take its place,
  // with the clients filter under them, so the page reads "who" then "which clients" before the numbers.
  const pick = /\n      <!-- my leads · pick a lead -->\n[\s\S]*?\n      <\/div>\n(?=\n      <!-- my leads · analysis)/;
  const head = /\n      <!-- header -->\n      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">\n        <h2[^\n]*\n        <span class="chip"[^\n]*\n        <span style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; align-items: center">\n([\s\S]*?)\n        <\/span>\n      <\/div>\n/;
  const clients = /\n        <div style="display: flex; align-items: center; gap: 10px; border-top: 1px solid #eef2f7; padding-top: 10px">\n([\s\S]*?\n          <\/div>)\n        <\/div>/;
  const mh = T[L].match(head), mc = T[L].match(clients);
  if (!pick.test(T[L]) || !mh || !mc) fail(L + ': header blocks');
  T[L] = T[L].replace(head, '\n').replace(clients, '');
  T[L] = T[L].replace(pick, `
      <!-- my leads · the lead picked in the sidebar, with the clients they run -->
      <div class="card" style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <span style="width: 36px; height: 36px; border-radius: 8px; background: #eef2f7; color: #0f2a4a; display: grid; place-items: center; font-size: 12px; font-weight: 600; flex: none">{{ldIni}}</span>
          <span style="display: flex; flex-direction: column; line-height: 1.3; min-width: 0"><b style="font-size: 16px; font-weight: 600">{{ldName}}</b><span class="mut" style="font-size: 12px">Project lead · {{ldSub}} · Sep to Oct 2026</span></span>
          <span style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
${mh[1]}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; border-top: 1px solid #eef2f7; padding-top: 10px">
${mc[1]}
        </div>
      </div>
`); bump(L);
  rep(L, "ldList, ldDonut, ldLegend, ldAreas, ldTot, ldFirst: ld.name.split(' ')[0],",
    "ldList, ldDonut, ldLegend, ldAreas, ldTot, ldFirst: ld.name.split(' ')[0], ldName: ld.name, ldIni: ld.ini, ldSub: (ldTot - ld.st[0]) + ' open · ' + ld.st[3] + ' overdue · 8 clients',");
  // Picking another lead while on My leads switches in place (the prototype will not navigate to the page
  // it is already on): proto.js fires vcfo:lead, and the page and the sidebar re-render.
  rep(L, '    const set = (o) => this.setState(o);', "    const set = (o) => this.setState(o);\n    if (!this.__ldl) { this.__ldl = 1; window.addEventListener('vcfo:lead', (e) => this.setState({ ld: e.detail })); }");
  rep('s/mgr/Side.dc.html', "    const active = this.props.active ?? 'today';", "    const active = this.props.active ?? 'today';\n    if (!this.__ldl) { this.__ldl = 1; window.addEventListener('vcfo:lead', () => this.setState({ ldTick: Date.now() })); }");
  // The sidebar marks the lead on show: the child row takes the ground and the rail, the parent stays plain.
  const S = 's/mgr/Side.dc.html';
  rep(S, "    const sub = this.props.sub ?? '';", "    let ldSel = ''; if (active === 'leads') { try { ldSel = sessionStorage.getItem('vcfo.lead') || ''; } catch (e) {} ldSel = ldSel || 'Bharath'; }\n    const sub = (this.props.sub ?? '') || ldSel;");
  rep(S, '<a href="#" title="{{l.tip}}" style="display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 8px; border-radius: 6px; color: #c9d6e8; font-size: 12.5px">',
    '<a href="#" title="{{l.tip}}" aria-label="{{l.tip}}" aria-current="{{l.cur}}" style="{{l.st}}">');
  // (The label also lets proto.js route the click: it matched the row text, which starts with the initials.)
  rep(S, "      name, ini, open: open + ' open', tip: name + ' · ' + open + ' open tasks',",
    "      name, ini, open: open + ' open', tip: name + ' · ' + open + ' open tasks', cur: ldSel === name.split(' ')[0] ? 'page' : 'false',\n      st: 'display:flex;align-items:center;gap:8px;height:28px;padding:0 8px;border-radius:6px;font-size:12.5px;' + (ldSel === name.split(' ')[0] ? 'color:#fff;font-weight:600;background:#1d3d64;box-shadow:inset 3px 0 0 #c9a24b' : 'color:#c9d6e8'),");
}

// ---------- 14. Compact filters, a More menu, and sidebar folds (owner, 23 Oct) ----------
// Only the filters that matter stay on screen, as compact dropdowns whose label names the choice:
// Clients and Show on Work and My leads, Intern and Company on Team tasks (status comes from its legend).
// Templates and Export move into a More menu. Styles are .ds-dd / .ds-pop / .ds-opt in ds.css.
{
  const CHEV = '<svg class="ds-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  const DOTS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01"></path></svg>';
  const scrim = (any, close) => `<sc-if value="{{${any}}}" hint-placeholder-val="{{false}}"><div class="ds-scrim" onClick="{{${close}}}" aria-hidden="true"></div></sc-if>`;
  const dd = (p, name, multi) => `<span class="ds-ddw"><button type="button" class="ds-dd" aria-haspopup="true" aria-expanded="{{${p}X}}" data-active="{{${p}On}}" aria-label="${name} filter: {{${p}Label}}" onClick="{{${p}Tog}}">{{${p}Label}}${CHEV}</button><sc-if value="{{${p}Open}}" hint-placeholder-val="{{false}}"><div class="ds-pop" role="group" aria-label="${name}">${multi ? `<div class="ds-pop-h"><span>${name}</span><button type="button" class="ds-lnk" onClick="{{${p}Clear}}">Clear</button></div>` : ''}<sc-for list="{{${p}Opts}}" as="o" hint-placeholder-count="4"><button type="button" class="ds-opt" aria-pressed="{{o.on}}" onClick="{{o.pick}}"><span class="${multi ? 'ds-cb' : 'ds-rd'}" aria-hidden="true"></span><i style="{{o.dot}}"></i>{{o.label}}</button></sc-for></div></sc-if></span>`;
  const more = (items) => `<span class="ds-ddw"><button type="button" class="ds-dd ds-icon" aria-haspopup="menu" aria-expanded="{{ddMoreX}}" aria-label="More actions" title="More actions" onClick="{{ddMoreTog}}">${DOTS}</button><sc-if value="{{ddMoreOpen}}" hint-placeholder-val="{{false}}"><div class="ds-pop ds-pop-r" role="menu" aria-label="More actions">${items.join('')}</div></sc-if></span>`;
  const toMenu = (b) => b.replace('<button type="button" class="btn">', '<button type="button" class="ds-opt" role="menuitem">');
  const VIEWSEG = /<span class="seg" role="group" aria-label="Work view">.*?<\/sc-for><\/span>/;
  const BTN = /^ *<button type="button" class="btn[^"]*">.*<\/button>$/gm;
  // The data the bar needs, added right after coChips in each screen's script.
  const DD_JS = `
    const coSel = s.co || [], showSel = s.show || 'all', ddOpen = s.dd || '';
    const ddTog = (k) => () => set({ dd: ddOpen === k ? '' : k });
    const SHOWS = [['all', 'Steps + filings'], ['steps', 'Steps only'], ['filings', 'Filings only']];
    const ddBar = {
      ddAny: !!ddOpen, ddClose: () => set({ dd: '' }),
      ddCoLabel: !coSel.length ? 'All clients' : (coSel.length === 1 ? C[coSel[0]][0] : coSel.length + ' clients'),
      ddCoOn: coSel.length ? 'true' : 'false', ddCoOpen: ddOpen === 'co', ddCoX: ddOpen === 'co' ? 'true' : 'false', ddCoTog: ddTog('co'), ddCoClear: () => set({ co: [] }),
      ddCoOpts: Object.keys(C).map(k => ({ label: C[k][0], dot: dot(k), on: coSel.includes(k) ? 'true' : 'false', pick: () => set({ co: coSel.includes(k) ? coSel.filter(x => x !== k) : coSel.concat(k) }) })),
      ddShLabel: SHOWS.find(x => x[0] === showSel)[1], ddShOn: showSel !== 'all' ? 'true' : 'false', ddShOpen: ddOpen === 'show', ddShX: ddOpen === 'show' ? 'true' : 'false', ddShTog: ddTog('show'),
      ddShOpts: SHOWS.map(([k, label]) => ({ label, dot: 'display:none', on: k === showSel ? 'true' : 'false', pick: () => set({ show: k, dd: '' }) })),
      ddMoreOpen: ddOpen === 'more', ddMoreX: ddOpen === 'more' ? 'true' : 'false', ddMoreTog: ddTog('more')
    };`;
  const coFit = (k) => `(!coSel.length || coSel.includes(${k}))`;
  for (const k of [...both('Work.dc.html'), 's/mgr/Leads.dc.html']) {
    rep(k, "    const coChips = Object.keys(C).map(k => ({ n: C[k][0], dot: dot(k) }));", "    const coChips = Object.keys(C).map(k => ({ n: C[k][0], dot: dot(k) }));" + DD_JS);
    rep(k, "calViews, dows, coChips,", "calViews, dows, coChips, ...ddBar,");
    // The filters filter: the timeline by client and by type (kind 'f' is a filing), the to-do lists by client.
    rep(k, "    const tl = T.filter(r => live(r[1], r[8])).map(", "    const tl = T.filter(r => live(r[1], r[8]) && " + coFit('r[1]') + " && (showSel === 'all' || (showSel === 'filings') === (r[4] === 'f'))).map(");
    rep(k, "[h, items.filter(it => live(it.k, it.need)), isNew]", "[h, items.filter(it => live(it.k, it.need) && " + coFit('it.k') + " && showSel !== 'filings'), isNew]");
  }
  for (const k of both('Work.dc.html')) {
    const re = /\n      <!-- header -->\n([\s\S]*?)\n      <!-- toolbar: view \+ type \+ date on one line, companies on the next -->\n([\s\S]*?\n      <\/div>)\n(?=\n\n      <div class="wcols">)/;
    const m = T[k].match(re); if (!m) fail(k + ': header and toolbar');
    const count = (m[1].match(/<span class="chip"[^>]*>[^<]*<\/span>/) || fail(k + ': count chip'))[0];
    const btns = m[1].match(BTN) || []; if (btns.length !== 4) fail(k + ': expected 4 header buttons, found ' + btns.length);
    const seg = (m[2].match(VIEWSEG) || fail(k + ': view segment'))[0];
    T[k] = T[k].replace(re, `
      <!-- toolbar: the count, the view, the two filters that matter, and the actions -->
      <div class="ds-bar">
        ${scrim('ddAny', 'ddClose')}
        ${count}
        ${seg}
        ${dd('ddCo', 'Clients', true)}
        ${dd('ddSh', 'Show', false)}
        <span style="margin-left: auto; display: flex; gap: 8px; align-items: center">
${btns[2]}
${btns[3]}
          ${more([toMenu(btns[0].trim()), toMenu(btns[1].trim())])}
        </span>
      </div>
`); bump(k);
  }
  {
    const L = 's/mgr/Leads.dc.html';
    const acts = /(<span style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; align-items: center">\n)([\s\S]*?)(\n          <\/span>)/;
    const m = T[L].match(acts); if (!m) fail(L + ': header actions');
    const btns = m[2].match(BTN) || []; if (btns.length !== 4) fail(L + ': expected 4 header buttons, found ' + btns.length);
    T[L] = T[L].replace(acts, (x, a, b, c) => a + btns[2] + '\n' + btns[3] + '\n          ' + more([toMenu(btns[0].trim()), toMenu(btns[1].trim())]) + c);
    const tb = /\n\n      <!-- toolbar: view \+ type \+ date on one line, companies on the next -->\n([\s\S]*?\n      <\/div>)\n/;
    const mt = T[L].match(tb); if (!mt) fail(L + ': toolbar card');
    const seg = (mt[1].match(VIEWSEG) || fail(L + ': view segment'))[0];
    T[L] = T[L].replace(tb, '\n');
    const row = /        <div style="display: flex; align-items: center; gap: 10px; border-top: 1px solid #eef2f7; padding-top: 10px">\n[\s\S]*?\n          <\/div>\n        <\/div>/;
    if (!row.test(T[L])) fail(L + ': clients row');
    T[L] = T[L].replace(row, `        <div class="ds-bar ds-bar-in">
          ${scrim('ddAny', 'ddClose')}
          ${seg}
          ${dd('ddCo', 'Clients', true)}
          ${dd('ddSh', 'Show', false)}
        </div>`); bump(L);
    if (/Fri 16 Oct · IST|>All 8</.test(T[L])) fail(L + ': old toolbar left behind');
  }
  for (const k of both('Work.dc.html')) if (/Fri 16 Oct · IST|>All 8</.test(T[k])) fail(k + ': old toolbar left behind');

  // Team tasks: Intern and Company as compact dropdowns; status from the legend rows beside it.
  const M = 's/mgr/Main.dc.html';
  const sel = /<span class="mt-fl">\n\s*<select class="mt-sel" aria-label="Intern"[\s\S]*?<\/select>\n\s*<select class="mt-sel" aria-label="Company"[\s\S]*?<\/select>\n\s*<select class="mt-sel" aria-label="Status"[\s\S]*?<\/select>\n/;
  if (!sel.test(T[M])) fail(M + ': team task selects');
  T[M] = T[M].replace(sel, `<span class="mt-fl">
              ${scrim('mtDdAny', 'mtDdClose')}
              ${dd('mtDi', 'Intern', false)}
              ${dd('mtDc', 'Company', false)}
`); bump(M);
  rep(M, '<div class="card mt-dn" data-donut="team-tasks" data-drill="{{mtDrill}}" role="button" tabindex="0" title="Open the task breakdown" aria-label="Team task status · open the breakdown" style="padding-bottom: 14px; cursor: pointer">',
    '<div class="card mt-dn" style="padding-bottom: 14px">');
  rep(M, '<div style="{{mtDonut}}" role="img" aria-label="{{mtDonutTip}}">',
    '<div style="{{mtDonut}}; cursor: pointer" data-donut="team-tasks" data-drill="{{mtDrill}}" role="button" tabindex="0" title="Open the task breakdown" aria-label="{{mtDonutTip}} · open the breakdown">');
  rep(M, '<div class="mt-lg" data-tip="{{c.label}} · {{c.n}}"><span style="{{c.sw}}"></span><span style="flex: 1">{{c.label}}</span><b class="sg" style="font-size: 14px">{{c.n}}</b></div></sc-for>',
    '<button type="button" class="mt-lg" aria-pressed="{{c.on}}" onClick="{{c.pick}}" title="{{c.tip}}"><span style="{{c.sw}}"></span><span style="flex: 1">{{c.label}}</span><b class="sg" style="font-size: 14px">{{c.n}}</b></button></sc-for>');
  rep(M, "    // pop-up content for the status card", `    const mtDd = s.mtDd || '', mtDdTog = (k) => () => set({ mtDd: mtDd === k ? '' : k });
    const mtDdo = {
      mtDdAny: !!mtDd, mtDdClose: () => set({ mtDd: '' }),
      mtDiLabel: mtI || 'All interns', mtDiOn: mtI ? 'true' : 'false', mtDiOpen: mtDd === 'i', mtDiX: mtDd === 'i' ? 'true' : 'false', mtDiTog: mtDdTog('i'),
      mtDiOpts: [''].concat(mtInterns).map(n => ({ label: n || 'All interns', dot: 'display:none', on: n === mtI ? 'true' : 'false', pick: () => set({ mtI: n, mtDd: '' }) })),
      mtDcLabel: mtC ? CL[mtC][0] : 'All companies', mtDcOn: mtC ? 'true' : 'false', mtDcOpen: mtDd === 'c', mtDcX: mtDd === 'c' ? 'true' : 'false', mtDcTog: mtDdTog('c'),
      mtDcOpts: [''].concat(Object.keys(CL).sort((a, b) => CL[a][0].localeCompare(CL[b][0]))).map(k => ({ label: k ? CL[k][0] : 'All companies', dot: k ? 'background:' + CL[k][1] : 'display:none', on: k === mtC ? 'true' : 'false', pick: () => set({ mtC: k, mtDd: '' }) }))
    };
    // pop-up content for the status card`);
  rep(M, "      digest, digest2, mtI, mtC, mtS,", "      ...mtDdo, digest, digest2, mtI, mtC, mtS,");
  rep(M, '<span class="mut" style="margin-left: auto; font-size: 11.5px">{{mtScope}} · click for details</span>', '');
}
{
  // Sidebar: Clients (both portals) and My leads (manager) fold with the real app's chevron (SidebarNavChevron).
  const CHEV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  for (const S of SIDES) {
    const row = /(        <a href="#" aria-current="\{\{n\.cur\}\}" style="\{\{n\.st\}\}">\n[\s\S]*?\n        <\/a>)/;
    if (!row.test(T[S])) fail(S + ': nav row');
    T[S] = T[S].replace(row, `        <div style="position: relative">
$1
        <sc-if value="{{n.canFold}}" hint-placeholder-val="{{false}}"><button type="button" class="ds-fold" data-nav-fold="{{n.foldKey}}" aria-expanded="{{n.openStr}}" aria-label="{{n.foldLabel}}" title="{{n.foldLabel}}">${CHEV}</button></sc-if>
        </div>`); bump(S);
    rep(S, "    const active = this.props.active ?? 'today';", "    const active = this.props.active ?? 'today';\n    if (!this.__nvl) { this.__nvl = 1; window.addEventListener('vcfo:nav', () => this.setState({ navTick: Date.now() })); }");
    rep(S, "    const C = [\n", `    let fold = { clients: true, leads: true };
    try { fold = { clients: sessionStorage.getItem('vcfo.nav.clients') !== '0', leads: sessionStorage.getItem('vcfo.nav.leads') !== '0' }; } catch (e) {}
    nav.forEach((n, i) => {
      const k = items[i][0]; n.canFold = k === 'clients' || k === 'leads'; if (!n.canFold) return;
      n.foldKey = k; n.openStr = fold[k] ? 'true' : 'false'; n.foldLabel = (fold[k] ? 'Hide ' : 'Show ') + (k === 'leads' ? 'leads' : 'clients');
      n.st += ';padding-right:36px'; n.isClients = n.isClients && fold[k]; n.isLeads = n.isLeads && fold[k];
    });
    const C = [
`);
  }
}

// ---------- 15. The open client is selected in the sidebar (owner, 23 Oct) ----------
// Client pages pass their company to the sidebar (taken from the breadcrumb). Its row takes the ground and
// the gold rail, and Clients itself stays plain (child-only highlight). A company outside the four the
// sidebar lists is added under them while it is open.
{
  for (const k of lead) {
    const m = T[k].match(/<dc-import name="Top" crumb="Today › Clients › ([^›"]+?)(?: › [^"]*)?"/);
    if (!m || !/<dc-import name="Side" active="clients"/.test(T[k])) continue;
    rep(k, '<dc-import name="Side" active="clients"', `<dc-import name="Side" active="clients" client="${m[1].trim()}"`);
  }
  const SEL = "color:#fff;font-weight:600;background:#1d3d64;box-shadow:inset 3px 0 0 #c9a24b";
  for (const S of SIDES) {
    const subLine = T[S].match(/\n    const sub = ([^\n]*);/); if (!subLine) fail(S + ': sub line');
    T[S] = T[S].replace(subLine[0], `\n    const curCl = this.props.client ?? '';\n    const sub = (${subLine[1]}) || (active === 'clients' ? curCl : '');`); bump(S);
    rep(S, "      ['Kestrel Health', '#0284c7', 'cmp', 'Compliance · Reg-1']\n    ];",
      "      ['Kestrel Health', '#0284c7', 'cmp', 'Compliance · Reg-1']\n    ];\n    const ALLC = { 'Tidewater Logistics': ['#0d9488', 'cmp', 'Compliance · Post-8'], 'Halcyon Fintech': ['#a16207', 'cmp', 'Compliance · Filing'], 'Larkspur Analytics': ['#16a34a', 'inc', 'Incorporating · Pre-2'], 'Juniper Bio': ['#64748b', 'inc', 'Incorporating · Pre-1'] };\n    if (curCl && !C.some(c => c[0] === curCl) && ALLC[curCl]) C.push([curCl].concat(ALLC[curCl]));");
    rep(S, '<a href="#" title="{{c.tip}}" style="display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 8px; border-radius: 6px; color: #c9d6e8; font-size: 12.5px">',
      '<a href="#" title="{{c.tip}}" aria-label="{{c.name}}" aria-current="{{c.cur}}" style="{{c.st}}">');
    rep(S, "      return { name, tip, phase: p === 'inc' ? 'Inc' : 'Cmp',",
      `      return { name, tip, phase: p === 'inc' ? 'Inc' : 'Cmp', cur: name === curCl ? 'page' : 'false',\n        st: 'display:flex;align-items:center;gap:8px;height:28px;padding:0 8px;border-radius:6px;font-size:12.5px;' + (name === curCl ? '${SEL}' : 'color:#c9d6e8'),`);
  }
}

// ---------- 16. People: one set of names in every portal (owner, 23 Oct) ----------
// Admin Krishna (new portal), manager Pranay (was Priya Raman), project lead Bharath (was Kavya Iyer).
// One layer under a manager: project leads Bharath, Sneha Kulkarni and Meera Nair. The interns and Rohan Das go.
{
  const L = 's/mgr/Leads.dc.html', S = 's/mgr/Side.dc.html', M = 's/mgr/Main.dc.html';
  // Lists that would collapse into duplicates are rewritten first.
  rep(L, "      Rohan: { name: 'Rohan Das', ini: 'RD',", "      Bharath: { name: 'Bharath', ini: 'BH',");
  rep(L, "if (!LD[ldKey]) ldKey = 'Sneha';", "if (!LD[ldKey]) ldKey = 'Bharath';");
  rep(S, "[['Sneha Kulkarni', 'SK', '#9ec5ff', 13], ['Meera Nair', 'MN', '#7fe3c2', 8], ['Rohan Das', 'RD', '#f5b38a', 13]]", "[['Bharath', 'BH', '', 13], ['Sneha Kulkarni', 'SK', '', 13], ['Meera Nair', 'MN', '', 8]]");
  rep('s/lead/Side.dc.html', "[['Priya Raman', 'PR', 'Project manager', ''], ['Arjun Mehta', 'AM', 'Project lead', '']]", "[['Pranay', 'PN', 'Manager', '']]");
  rep(S, "[['Priya Raman', 'PR', 'Project manager', ''], ['Arjun Mehta', 'AM', 'Project lead', '']]", "[['Krishna', 'KR', 'Admin', '']]");
  rep('proto.js', "var LDS = { Sneha: ['Sneha Kulkarni', [9, 4, 3, 2, 4]], Meera: ['Meera Nair', [12, 3, 2, 0, 3]], Rohan: ['Rohan Das', [6, 5, 3, 3, 2]] };",
    "var LDS = { Bharath: ['Bharath', [6, 5, 3, 3, 2]], Sneha: ['Sneha Kulkarni', [9, 4, 3, 2, 4]], Meera: ['Meera Nair', [12, 3, 2, 0, 3]] };");
  rep('proto.js', "var k = 'Sneha'; try { k = sessionStorage.getItem('vcfo.lead') || k; } catch (e) {} if (!LDS[k]) k = 'Sneha';", "var k = 'Bharath'; try { k = sessionStorage.getItem('vcfo.lead') || k; } catch (e) {} if (!LDS[k]) k = 'Bharath';");
  rep('proto.js', "off = k === 'Meera' ? 5 : (k === 'Rohan' ? 11 : 0);", "off = k === 'Meera' ? 5 : (k === 'Bharath' ? 11 : 0);");
  rep('proto.js', "var IN = ['Riya Shah', 'Karan Iyer', 'Ananya Rao', 'Dev Patel'];", "var IN = [name];");
  repAll('proto.js', /\/\^\(Sneha\|Meera\|Rohan\) \//g, '/^(Bharath|Sneha|Meera) /');
  // Team tasks: the person on a task is its project lead; the separate Lead column goes.
  repAll(M, /\['(BR|TL|KH|HF|NT|OL|LA|JB)', '([^']+)', '([^']+)', '(Sneha Kulkarni|Meera Nair|Rohan Das)', /g, (m, k, t, i, l) => `['${k}', '${t}', '${l}', '${l}', `);
  // The code calls the person on a task `intern`; rename it so the wording swap below cannot touch code.
  repAll(M, /\br\.intern\b/g, 'r.plead'); repAll(M, /task, intern, lead/g, 'task, plead, lead');
  if (/[.,] ?intern\b/.test(T[M].replace(/\/\/[^\n]*/g, ''))) fail(M + ': intern identifier left');
  rep(M, "const mtIni = (n) => n.split(' ').map(w => w[0]).join('');", "const mtIni = (n) => n.indexOf(' ') < 0 ? n.slice(0, 2).toUpperCase() : n.split(' ').map(w => w[0]).join('');");
  rep(M, "const mtInterns = ['Ananya Rao', 'Dev Patel', 'Karan Iyer', 'Riya Shah'];", "const mtInterns = ['Bharath', 'Meera Nair', 'Sneha Kulkarni'];");
  rep(M, "<thead><tr><th>Task</th><th>Company</th><th>Status</th><th>Lead</th></tr></thead>", "<thead><tr><th>Task</th><th>Company</th><th>Status</th></tr></thead>");
  repAll(M, /<\/td><td><span[^<]*<span style="\{\{r\.ldAv\}\}">\{\{r\.ldK\}\}<\/span>\{\{r\.lead\}\}<\/span><\/td><\/tr>/, '</td></tr>');
  if (/\{\{r\.lead\}\}/.test(T[M])) fail(M + ': lead column still present');
  rep(M, " + ' · lead ' + r.lead,", ",");
  for (const k of ['s/mgr/Work.dc.html', L]) {
    rep(k, "const ASG_IN = [['Ananya Rao', 'AR'], ['Dev Patel', 'DP'], ['Karan Iyer', 'KI'], ['Riya Shah', 'RS']];", "const ASG_IN = [['Bharath', 'BH'], ['Meera Nair', 'MN'], ['Sneha Kulkarni', 'SK']];");
    rep(k, "const ASG_BASE = { 'Ananya Rao': 3, 'Dev Patel': 3, 'Karan Iyer': 4, 'Riya Shah': 3 };", "const ASG_BASE = { 'Bharath': 4, 'Meera Nair': 3, 'Sneha Kulkarni': 3 };");
    rep(k, "{ 'FC-GPR Filing': 'Riya Shah', 'GST Registration': 'Karan Iyer', 'Monthly GST reconciliation': 'Ananya Rao' }", "{ 'FC-GPR Filing': 'Sneha Kulkarni', 'GST Registration': 'Meera Nair', 'Monthly GST reconciliation': 'Bharath' }");
  }
  // Names, then titles.
  const staff = (k) => /^s\/(lead|mgr)\//.test(k) || k === 'proto.js';
  for (const k of Object.keys(T).filter(isScreenish).concat(['proto.js', 'tl-editor.js'])) {
    if (!(k in T)) continue;
    if (staff(k)) { for (const [a, b] of [['Rohan Das', 'Bharath'], ['Riya Shah', 'Sneha Kulkarni'], ['Karan Iyer', 'Meera Nair'], ['Ananya Rao', 'Bharath'], ['Dev Patel', 'Bharath']]) repAll(k, new RegExp(a, 'g'), b); }
    repAll(k, /kavya\.iyer@/g, 'bharath@'); repAll(k, /Kavya Iyer/g, 'Bharath'); repAll(k, /\bKavya\b/g, 'Bharath');
    repAll(k, /priya\.raman@/g, 'pranay@'); repAll(k, /Priya Raman/g, 'Pranay'); repAll(k, /\bPriya\b/g, 'Pranay');
    // Arjun Mehta was Northwind's project lead on the client side and a colleague on staff screens.
    if (/^s\/lead\//.test(k)) { repAll(k, /Arjun Mehta/g, 'Pranay'); repAll(k, /\bArjun\b/g, 'Pranay'); }
    else { repAll(k, /Arjun Mehta/g, 'Bharath'); repAll(k, /\bArjun\b/g, 'Bharath'); }
    repAll(k, /Project Manager|Engagement manager|Compliance manager|Project manager/g, 'Manager');
    repAll(k, /Project Lead/g, 'Project lead');
    // "Ball in court" is sports slang; the firm's word is "Pending with" (owner, 23 Oct).
    repAll(k, /BALL IN COURT/g, 'PENDING WITH'); repAll(k, /Ball in court/g, 'Pending with'); repAll(k, /<th>Ball<\/th>/g, '<th>Pending with</th>');
    repAll(k, /Ball: me\b/g, 'Pending with me');
    if (/Pranay|Bharath/.test(T[k])) { repAll(k, />PR</g, '>PN<'); repAll(k, />AM</g, '>BH<'); repAll(k, />KI</g, '>BH<'); }
    // Initials kept in data next to the name: ini: 'AM' beside 'Bharath', person('PR','Pranay', ...).
    for (const [nm, to] of [['Pranay', 'PN'], ['Bharath', 'BH']]) for (const from of ['PR', 'AM', 'KI']) {
      repAll(k, new RegExp("(['\"])" + from + "\\1([^\\n]{0,40}?" + nm + ")", 'g'), '$1' + to + '$1$2');
      repAll(k, new RegExp('(' + nm + "[^\\n]{0,40}?)(['\"])" + from + '\\2', 'g'), '$1$2' + to + '$2');
    }
    repAll(k, /arjun\.mehta@/g, /^s\/lead\//.test(k) ? 'pranay@' : 'bharath@');
    if (staff(k)) {
      repAll(k, /My leads/g, 'Project leads');
      repAll(k, /\bInterns\b/g, 'Project leads'); repAll(k, /\binterns\b/g, 'project leads'); repAll(k, /\bIntern\b/g, 'Project lead'); repAll(k, /\bintern\b/g, 'project lead');
      repAll(k, /\ban project lead/g, 'a project lead'); repAll(k, /\bAn project lead/g, 'A project lead');
    }
  }
  // Sidebar account tiles set in section 3.
  repAll('s/mgr/Side.dc.html', /(font-size: 11px; font-weight: 600; flex: none">)PR(<\/span>)/, '$1PN$2');
  repAll('s/lead/Side.dc.html', /(font-size: 11px; font-weight: 600; flex: none">)KI(<\/span>)/, '$1BH$2');
  repAll('proto.js', /\[\/\^My \[Ll\]eads\|/, '[/^Project leads|^My [Ll]eads|');
  if (!T['proto.js'].includes('[/^Project leads|')) fail('proto.js: project leads nav');
  for (const k of Object.keys(T).filter((k) => /^s\/(lead|mgr)\//.test(k))) {
    const bad = T[k].match(/Kavya|Priya|Riya Shah|Karan Iyer|Ananya Rao|Dev Patel|Rohan Das|\b[Ii]nterns?\b|My leads/);
    if (bad) fail(k + ': old name left: ' + bad[0]);
  }
}

// ---------- 17. Admin portal: Krishna oversees managers (owner, 23 Oct) ----------
// New screens live in proto-fix/admin/ (Side, Main, Work, Managers, Clients, data.js, assign.js); the rest are
// copies of the manager screens after every fix above. Routes are admin-*; proto.js learns the role.
{
  const AD = join(here, 'admin');
  const CSS = readFileSync(join(AD, 'admin.css'), 'utf8');
  const CHEV = '<svg class="ds-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  const ddM = (p, name) => `<span class="ds-ddw"><button type="button" class="ds-dd" aria-haspopup="true" aria-expanded="{{${p}X}}" data-active="{{${p}On}}" aria-label="${name} filter: {{${p}Label}}" onClick="{{${p}Tog}}">{{${p}Label}}${CHEV}</button><sc-if value="{{${p}Open}}" hint-placeholder-val="{{false}}"><div class="ds-pop" role="group" aria-label="${name}"><sc-for list="{{${p}Opts}}" as="o" hint-placeholder-count="4"><button type="button" class="ds-opt" aria-pressed="{{o.on}}" onClick="{{o.pick}}"><span class="ds-rd" aria-hidden="true"></span><i style="{{o.dot}}"></i>{{o.label}}</button></sc-for></div></sc-if></span>`;
  const SCRIM = '<sc-if value="{{ddAny}}" hint-placeholder-val="{{false}}"><div class="ds-scrim" onClick="{{ddClose}}" aria-hidden="true"></div></sc-if>';
  const expand = (src) => src.replace('/*@admin-css*/', () => CSS).replace(/<!--dd:(\w+):([^>]+?)-->/g, (m, p, n) => ddM(p, n)).replace(/<!--scrim-->/g, SCRIM);
  for (const f of ['data.js', 'assign.js']) T['s/admin/' + f] = readFileSync(join(AD, f), 'utf8');
  for (const f of ['Side', 'Main', 'Work', 'Managers', 'Clients']) T[`s/admin/${f}.dc.html`] = expand(readFileSync(join(AD, f + '.dc.html'), 'utf8'));
  for (const f of ['Email', 'Vault', 'Knowledge', 'Announcements', 'Notifications', 'CompCal', 'Filings', 'Analytics', 'Audit', 'Settings', 'Palette', 'Chat', 'Launcher', 'Top', 'Overview', 'Step', 'Documents', 'BoardRes']) {
    let t = T['s/mgr/' + f + '.dc.html']; if (!t) fail('no s/mgr/' + f);
    t = t.replace(/<title>Manager · /, '<title>Admin · ').replace(/<title>Manager /, '<title>Admin ');
    if (!['Overview', 'Step', 'Documents', 'BoardRes'].includes(f)) t = t.replace(/\bPranay\b/g, 'Krishna').replace(/pranay@/g, 'krishna@').replace(/>PN</g, '>KR<');
    T['s/admin/' + f + '.dc.html'] = t;
  }
  for (const k of Object.keys(T).filter((k) => /^s\/admin\/.*\.dc\.html$/.test(k))) {
    if (!T[k].includes('<script src="./data.js">')) T[k] = T[k].replace('<script src="./support.js"></script>', '<script src="./support.js"></script>\n<script src="./data.js"></script>');
    T[k] = T[k].replace('<script src="./data.js"></script>', '<script src="./data.js"></script>\n<script src="./assign.js"></script>');
    if (!T[k].includes('./assign.js')) fail(k + ': admin scripts');
  }
  rep('s/admin/Settings.dc.html', 'Manager', 'Admin', (T['s/admin/Settings.dc.html'].match(/Manager/g) || []).length);
  // The client view, read-only for the admin: no CC edits, no timeline edit; the manager and Reassign in the header.
  const O = 's/admin/Overview.dc.html';
  repAll(O, / ?<span(?: aria-label="Remove")? style="opacity: ?\.6;?">[✕×]<\/span>/g, '');
  if (/opacity: ?\.6;?">[✕×]/.test(T[O])) fail(O + ': CC remove buttons left');
  rep(O, '<button type="button" class="cc" style="border: 0; font: inherit; font-size: 12px; cursor: pointer">+ Add CC</button>', '');
  repAll(O, /<button[^>]*><svg width="13" height="13"[^>]*><path d="M12 20h9M16\.5 3\.5a2\.1 2\.1 0 0 1 3 3L7 19l-4 1 1-4Z"><\/path><\/svg>Edit<\/button>/, '');
  rep(O, '<span style="color: #c9d6e8">Rohan Kumar ·</span><a href="#" style="color: #e6c46e">rohan@northwind.example</a>',
    '<span style="color: #c9d6e8">Rohan Kumar ·</span><a href="#" style="color: #e6c46e">rohan@northwind.example</a><span style="color: #c9d6e8; margin-left: 14px">Manager: <b style="color: #fff; font-weight: 600">Pranay</b> · Project lead: <b style="color: #fff; font-weight: 600">Bharath</b></span><button type="button" class="ds-lnk" data-admin-assign="client" data-client="NT" style="color: #9ec5ff">Reassign</button><button type="button" class="ds-lnk" data-admin-assign="task" data-client="NT" style="color: #9ec5ff">Assign a task</button>');
  D.alias['s/admin/support.js'] = 's/docs/support.js';
  const RT = { 'admin-home': ['Main', 'Admin · Today'], 'admin-work': ['Work', 'Admin · Work'], 'admin-managers': ['Managers', 'Admin · Managers'], 'admin-clients': ['Clients', 'Admin · Clients'],
    'admin-overview': ['Overview', 'Admin · Clients · Northwind'], 'admin-step': ['Step', 'Admin · Step page'], 'admin-documents': ['Documents', 'Admin · Documents'], 'admin-board-resolution': ['BoardRes', 'Admin · Board resolution'],
    'admin-email': ['Email', 'Admin · Email'], 'admin-vault': ['Vault', 'Admin · Vault'], 'admin-knowledge-bank': ['Knowledge', 'Admin · Knowledge bank'], 'admin-announcements': ['Announcements', 'Admin · Announcements'],
    'admin-notifications': ['Notifications', 'Admin · Notifications'], 'admin-compliances': ['CompCal', 'Admin · Compliances · Calendar'], 'admin-filings': ['Filings', 'Admin · Compliances · Filings'],
    'admin-analytics': ['Analytics', 'Admin · Analytics'], 'admin-audit': ['Audit', 'Admin · Audit'], 'admin-settings': ['Settings', 'Admin · Settings'], 'admin-search': ['Palette', 'Admin · Search and bells'], 'admin-chat': ['Chat', 'Admin · Ask VCFO chat'] };
  const routes = {}; for (const [r, [f, t]] of Object.entries(RT)) routes[r] = { d: `s/admin/${f}.dc.html`, t, role: 'admin' };
  T['routes.js'] += '\n/* v10: Admin portal routes (role: admin), added by proto-fix/patch.mjs */\nObject.assign(window.__VCFO_ROUTES, ' + JSON.stringify(routes) + ');\n';
  // proto.js: the admin role next to lead and manager.
  rep('proto.js', "var LEADPG = /(^|\\/)s\\/(lead|mgr)\\//.test(String(window.__VPATH || location.pathname));", "var LEADPG = /(^|\\/)s\\/(lead|mgr|admin)\\//.test(String(window.__VPATH || location.pathname));");
  rep('proto.js', "  function rmap(k) { return (MGRPG && k && /^lead-/.test(k) && R['mgr-' + k.slice(5)]) ? 'mgr-' + k.slice(5) : k; }",
    "  var ADMPG = /(^|\\/)s\\/admin\\//.test(String(window.__VPATH || location.pathname)), PRE = ADMPG ? 'admin-' : (MGRPG ? 'mgr-' : '');\n  function rmap(k) { return (PRE && k && /^lead-/.test(k) && R[PRE + k.slice(5)]) ? PRE + k.slice(5) : k; }");
  rep('proto.js', "    var role = MGRPG ? 'mgr' : (LEADPG ? 'lead' : 'client');\n    seg([['client', 'Client'], ['lead', 'Lead'], ['mgr', 'Manager']], role, function (v) { if (v === role) return; store.set('role', v); go(v === 'mgr' ? 'mgr-home' : (v === 'lead' ? 'lead-home' : 'home')); }, 'vp-role');",
    "    var role = ADMPG ? 'admin' : (MGRPG ? 'mgr' : (LEADPG ? 'lead' : 'client'));\n    seg([['client', 'Client'], ['lead', 'Lead'], ['mgr', 'Manager'], ['admin', 'Admin']], role, function (v) { if (v === role) return; store.set('role', v); go({ mgr: 'mgr-home', lead: 'lead-home', admin: 'admin-home' }[v] || 'home'); }, 'vp-role');");
  rep('proto.js', "    var h = (here() || '').replace(/^mgr-/, 'lead-');", "    var h = (here() || '').replace(/^(mgr|admin)-/, 'lead-');");
  rep('proto.js', "  var LSIDE = [[/^VCFO Suite/, 'lead-home'],", "  var LSIDE = [[/^Managers|^(Pranay|Priya Raman|Arjun Mehta)$/, 'lead-managers'], [/^VCFO Suite/, 'lead-home'],");
  repAll('proto.js', /\(Northwind\|Orchid\|Brightwave\|Kestrel\|Tidewater\|Halcyon\|Larkspur\|Juniper\)/g, '(Northwind|Orchid|Brightwave|Kestrel|Tidewater|Halcyon|Larkspur|Juniper|Saffron|Monsoon|Indigo|Banyan|Coral|Quartz)');
}

// ---------- 18. Super admin portal: Mithilesh sees the whole firm (owner, 23 Oct) ----------
// Two admins (Krishna, Ritu Agarwal), four managers, 17 clients; the practice areas, team, money, risks,
// growth, the monthly partner report and firm settings. Source files in proto-fix/super/; data in admin/data.js.
{
  const SD = join(here, 'super'), AD = join(here, 'admin');
  const CSS = readFileSync(join(AD, 'admin.css'), 'utf8'), SCSS = readFileSync(join(SD, 'super.css'), 'utf8');
  const CHEV = '<svg class="ds-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  const ddM = (p, name) => `<span class="ds-ddw"><button type="button" class="ds-dd" aria-haspopup="true" aria-expanded="{{${p}X}}" data-active="{{${p}On}}" aria-label="${name} filter: {{${p}Label}}" onClick="{{${p}Tog}}">{{${p}Label}}${CHEV}</button><sc-if value="{{${p}Open}}" hint-placeholder-val="{{false}}"><div class="ds-pop" role="group" aria-label="${name}"><sc-for list="{{${p}Opts}}" as="o" hint-placeholder-count="4"><button type="button" class="ds-opt" aria-pressed="{{o.on}}" onClick="{{o.pick}}"><span class="ds-rd" aria-hidden="true"></span><i style="{{o.dot}}"></i>{{o.label}}</button></sc-for></div></sc-if></span>`;
  const SCRIM = '<sc-if value="{{ddAny}}" hint-placeholder-val="{{false}}"><div class="ds-scrim" onClick="{{ddClose}}" aria-hidden="true"></div></sc-if>';
  const expand = (src) => src.replace('/*@admin-css*/', () => CSS).replace('/*@super-css*/', () => SCSS).replace(/<!--dd:(\w+):([^>]+?)-->/g, (m, p, n) => ddM(p, n)).replace(/<!--scrim-->/g, SCRIM);
  T['s/super/data.js'] = T['s/admin/data.js']; T['s/super/assign.js'] = T['s/admin/assign.js'];
  const NEW = ['Side', 'Main', 'Clients', 'Incorporation', 'Registrations', 'Team', 'Risks', 'Growth', 'Reports', 'Settings'];
  for (const f of NEW) T[`s/super/${f}.dc.html`] = expand(readFileSync(join(SD, f + '.dc.html'), 'utf8'));
  for (const f of ['Top', 'Overview', 'Step', 'Documents', 'BoardRes', 'Palette', 'Chat', 'Launcher', 'CompCal', 'Filings']) {
    let t = T['s/admin/' + f + '.dc.html']; if (!t) fail('no s/admin/' + f);
    t = t.replace(/<title>Admin · /, '<title>Super admin · ').replace(/<title>Admin /, '<title>Super admin ');
    if (!['Overview', 'Step', 'Documents', 'BoardRes'].includes(f)) t = t.replace(/\bKrishna\b/g, 'Mithilesh').replace(/krishna@/g, 'mithilesh@').replace(/>KR</g, '>MI<');
    T['s/super/' + f + '.dc.html'] = t;
  }
  for (const k of Object.keys(T).filter((k) => /^s\/super\/.*\.dc\.html$/.test(k))) {
    if (!T[k].includes('<script src="./data.js">')) T[k] = T[k].replace('<script src="./support.js"></script>', '<script src="./support.js"></script>\n<script src="./data.js"></script>');
    if (!T[k].includes('./assign.js')) T[k] = T[k].replace('<script src="./data.js"></script>', '<script src="./data.js"></script>\n<script src="./assign.js"></script>');
  }
  // Compliances is the same calendar (and filings register) every other portal uses (owner, 23 Oct).
  for (const f of ['CompCal', 'Filings']) {
    const k = 's/super/' + f + '.dc.html';
    repAll(k, /<dc-import name="Side" active="compliances" sub="(Calendar|Filings)"/g, '<dc-import name="Side" active="practice" sub="Compliances"');
    repAll(k, /crumb="Today › Compliances › /g, 'crumb="Overview › Compliances › ');
    if (!T[k].includes('active="practice"')) fail(k + ': sidebar');
  }
  // The client view names the admin too.
  rep('s/super/Overview.dc.html', 'Manager: <b style="color: #fff; font-weight: 600">Pranay</b>', 'Admin: <b style="color: #fff; font-weight: 600">Krishna</b> · Manager: <b style="color: #fff; font-weight: 600">Pranay</b>');
  D.alias['s/super/support.js'] = 's/docs/support.js';
  const RT = { 'super-home': ['Main', 'Super admin · Overview'], 'super-clients': ['Clients', 'Super admin · Clients'], 'super-overview': ['Overview', 'Super admin · Clients · Northwind'],
    'super-incorporation': ['Incorporation', 'Super admin · Practice · Incorporation'], 'super-registrations': ['Registrations', 'Super admin · Practice · Registrations'],
    'super-compliances': ['CompCal', 'Super admin · Compliances · Calendar'], 'super-filings': ['Filings', 'Super admin · Compliances · Filings'], 'super-team': ['Team', 'Super admin · Team'], 
    'super-risks': ['Risks', 'Super admin · Risks'], 'super-growth': ['Growth', 'Super admin · Growth'], 'super-reports': ['Reports', 'Super admin · Reports'],
    'super-settings': ['Settings', 'Super admin · Firm settings'], 'super-step': ['Step', 'Super admin · Step page'], 'super-documents': ['Documents', 'Super admin · Documents'],
    'super-board-resolution': ['BoardRes', 'Super admin · Board resolution'], 'super-search': ['Palette', 'Super admin · Search'], 'super-chat': ['Chat', 'Super admin · Ask VCFO chat'] };
  const routes = {}; for (const [r, [f, t]] of Object.entries(RT)) routes[r] = { d: `s/super/${f}.dc.html`, t, role: 'super' };
  T['routes.js'] += '\n/* v10: Super admin portal routes (role: super), added by proto-fix/patch.mjs */\nObject.assign(window.__VCFO_ROUTES, ' + JSON.stringify(routes) + ');\n';
  rep('proto.js', "var LEADPG = /(^|\\/)s\\/(lead|mgr|admin)\\//.test(String(window.__VPATH || location.pathname));", "var LEADPG = /(^|\\/)s\\/(lead|mgr|admin|super)\\//.test(String(window.__VPATH || location.pathname));");
  rep('proto.js', "PRE = ADMPG ? 'admin-' : (MGRPG ? 'mgr-' : '');", "SUPPG = /(^|\\/)s\\/super\\//.test(String(window.__VPATH || location.pathname)), PRE = SUPPG ? 'super-' : (ADMPG ? 'admin-' : (MGRPG ? 'mgr-' : ''));");
  rep('proto.js', "var role = ADMPG ? 'admin' : (MGRPG ? 'mgr' : (LEADPG ? 'lead' : 'client'));", "var role = SUPPG ? 'super' : (ADMPG ? 'admin' : (MGRPG ? 'mgr' : (LEADPG ? 'lead' : 'client')));");
  rep('proto.js', "['admin', 'Admin']], role, function (v) { if (v === role) return; store.set('role', v); go({ mgr: 'mgr-home', lead: 'lead-home', admin: 'admin-home' }[v] || 'home'); }",
    "['admin', 'Admin'], ['super', 'Super admin']], role, function (v) { if (v === role) return; store.set('role', v); go({ mgr: 'mgr-home', lead: 'lead-home', admin: 'admin-home', super: 'super-home' }[v] || 'home'); }");
  rep('proto.js', "    var h = (here() || '').replace(/^(mgr|admin)-/, 'lead-');", "    var h = (here() || '').replace(/^(mgr|admin|super)-/, 'lead-');");
  rep('proto.js', "  var LSIDE = [[/^Managers|", "  var LSIDE = [[/^Overview/, 'lead-home'], [/^Practice areas|^Incorporation$/, 'lead-incorporation'], [/^Registrations$/, 'lead-registrations'], [/^Team$/, 'lead-team'], [/^Risks/, 'lead-risks'], [/^Growth$/, 'lead-growth'], [/^Reports$/, 'lead-reports'], [/^Managers|");
  repAll('proto.js', /\|Saffron\|Monsoon\|Indigo\|Banyan\|Coral\|Quartz\)/g, '|Saffron|Monsoon|Indigo|Banyan|Coral|Quartz|Pinecrest|Saltmarsh|Ember)');
}

// ---------- 19. Practice areas on every dashboard (owner, 23 Oct) ----------
// The super admin's three cards (incorporation, registrations, compliances), scoped to each portal:
// project lead and manager see Pranay's clients, the admin Krishna's, the client Northwind.
{
  const SH = join(here, 'shared');
  const P = readFileSync(join(SH, 'Practice.dc.html'), 'utf8');
  for (const d of ['lead', 'mgr', 'admin']) T[`s/${d}/Practice.dc.html`] = P;
  D.alias['s/lead/data.js'] = 's/admin/data.js'; D.alias['s/mgr/data.js'] = 's/admin/data.js';
  for (const k of TODAYS) {
    if (!T[k].includes('./data.js')) T[k] = T[k].replace('<script src="./support.js"></script>', '<script src="./support.js"></script>\n<script src="./data.js"></script>');
    rep(k, '      <!-- 4 · shared · this week (option 3) -->', '      <!-- practice areas (owner, 23 Oct) -->\n      <dc-import name="Practice" scope="pranay" hint-size="100%,280px"></dc-import>\n\n      <!-- 4 · shared · this week (option 3) -->');
  }
  if (!T['s/admin/Main.dc.html'].includes('name="Practice"')) fail('admin Today: practice areas');
  // The client practice row was removed on 26 Oct (owner: it repeats the timeline and Steps).
}

// ---------- 20. Developer console: Farhath manages SBC's setup (owner, 23 Oct) ----------
// Connections, message routing (which message goes from which address or number), jobs, logs, deploys,
// access and secrets, data and costs, and an audit of every change. Every change asks first (dev/confirm.js).
{
  const VD = join(here, 'dev'), AD = join(here, 'admin'), SD = join(here, 'super');
  const CSS = readFileSync(join(AD, 'admin.css'), 'utf8'), SCSS = readFileSync(join(SD, 'super.css'), 'utf8'), DCSS = readFileSync(join(VD, 'dev.css'), 'utf8');
  const CHEV = '<svg class="ds-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  const ddM = (p, name) => `<span class="ds-ddw"><button type="button" class="ds-dd" aria-haspopup="true" aria-expanded="{{${p}X}}" data-active="{{${p}On}}" aria-label="${name} filter: {{${p}Label}}" onClick="{{${p}Tog}}">{{${p}Label}}${CHEV}</button><sc-if value="{{${p}Open}}" hint-placeholder-val="{{false}}"><div class="ds-pop" role="group" aria-label="${name}"><sc-for list="{{${p}Opts}}" as="o" hint-placeholder-count="4"><button type="button" class="ds-opt" aria-pressed="{{o.on}}" onClick="{{o.pick}}"><span class="ds-rd" aria-hidden="true"></span><i style="{{o.dot}}"></i>{{o.label}}</button></sc-for></div></sc-if></span>`;
  const SCRIM = '<sc-if value="{{ddAny}}" hint-placeholder-val="{{false}}"><div class="ds-scrim" onClick="{{ddClose}}" aria-hidden="true"></div></sc-if>';
  const expand = (src) => src.replace('/*@admin-css*/', () => CSS).replace('/*@super-css*/', () => SCSS).replace('/*@dev-css*/', () => DCSS).replace(/<!--dd:(\w+):([^>]+?)-->/g, (m, p, n) => ddM(p, n)).replace(/<!--scrim-->/g, SCRIM);
  T['s/dev/devdata.js'] = readFileSync(join(VD, 'data.js'), 'utf8');
  T['s/dev/confirm.js'] = readFileSync(join(VD, 'confirm.js'), 'utf8');
  D.alias['s/dev/data.js'] = 's/admin/data.js'; D.alias['s/dev/support.js'] = 's/docs/support.js';
  const NEW = ['Side', 'Main', 'Connections', 'Messages', 'Jobs', 'Logs', 'Deploys', 'Access', 'Data', 'Audit'];
  for (const f of NEW) T[`s/dev/${f}.dc.html`] = expand(readFileSync(join(VD, f + '.dc.html'), 'utf8'));
  for (const f of ['Top', 'Palette', 'Chat', 'Launcher']) {
    let t = T['s/super/' + f + '.dc.html']; if (!t) fail('no s/super/' + f);
    t = t.replace(/<title>Super admin · /, '<title>Developer · ').replace(/<title>Super admin /, '<title>Developer ').replace(/\bMithilesh\b/g, 'Farhath').replace(/mithilesh@/g, 'farhath@').replace(/>MI</g, '>FA<');
    if (!t.includes('./devdata.js')) t = t.replace('<script src="./support.js"></script>', '<script src="./support.js"></script>\n<script src="./data.js"></script>\n<script src="./devdata.js"></script>\n<script src="./confirm.js"></script>');
    T['s/dev/' + f + '.dc.html'] = t;
  }
  // Owner, 26 Oct: the developer console takes the lcc Settings shape (a section rail, then cards of
  // label-and-value rows) with every setting of every connection. One Console component draws each page.
  T['s/dev/devdetail.js'] = readFileSync(join(VD, 'detail.js'), 'utf8');
  T['s/dev/Console.dc.html'] = expand(readFileSync(join(VD, 'Console.dc.html'), 'utf8'));
  const CONSOLE = { Main: ['today', 'overview', 'Overview'], Connections: ['connections', 'connections', 'Overview › Connections'], Messages: ['messages', 'messages', 'Overview › Messages'],
    Jobs: ['jobs', 'jobs', 'Overview › Jobs'], Logs: ['logs', 'logs', 'Overview › Logs'], Deploys: ['deploys', 'deploys', 'Overview › Deploys'], Access: ['access', 'access', 'Overview › Access'],
    Data: ['data', 'data', 'Overview › Data and costs'], Audit: ['audit', 'audit', 'Overview › Audit'] };
  for (const [f, [act, sec, crumb]] of Object.entries(CONSOLE)) {
    T[`s/dev/${f}.dc.html`] = expand(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Developer · ${crumb.split(' › ').pop()}</title>
<script src="./support.js"></script>
<script src="./data.js"></script>
<script src="./devdata.js"></script>
<script src="./devdetail.js"></script>
<script src="./confirm.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
/*@admin-css*/
/*@super-css*/
/*@dev-css*/
</style>
</helmet>
<div class="L" style="display: flex; flex-wrap: wrap; min-height: 100vh; position: relative; background: #fafbfc">
  <div style="flex: 1 1 248px; max-width: 248px; background: #15263b"><dc-import name="Side" active="${act}" mode="{{mode}}" hint-size="248px,1000px"></dc-import></div>
  <div style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column">
    <dc-import name="Top" crumb="${crumb}" mode="{{mode}}" on-mode="{{setMode}}" hint-size="100%,56px"></dc-import>
    <main style="width: 100%; flex: 1; min-width: 0"><dc-import name="Console" sec="${sec}" hint-size="100%,1200px"></dc-import></main>
  </div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":1200}}'>
class Component extends DCLogic {
  renderVals() { const s = this.state || {}; return { mode: s.mode || 'mixed', setMode: (m) => this.setState({ mode: m }) }; }
}
</script>
<script src="../../routes.js"></script><script src="../../proto.js"></script>
</body>
</html>
`);
  }
  const RT = { 'dev-home': ['Main', 'Developer · Overview'], 'dev-connections': ['Connections', 'Developer · Connections'], 'dev-messages': ['Messages', 'Developer · Messages'],
    'dev-jobs': ['Jobs', 'Developer · Jobs'], 'dev-logs': ['Logs', 'Developer · Logs'], 'dev-deploys': ['Deploys', 'Developer · Deploys'], 'dev-access': ['Access', 'Developer · Access'],
    'dev-data': ['Data', 'Developer · Data and costs'], 'dev-audit': ['Audit', 'Developer · Audit'], 'dev-search': ['Palette', 'Developer · Search'], 'dev-chat': ['Chat', 'Developer · Ask VCFO chat'] };
  const routes = {}; for (const [r, [f, t]] of Object.entries(RT)) routes[r] = { d: `s/dev/${f}.dc.html`, t, role: 'dev' };
  T['routes.js'] += '\n/* v10: Developer console routes (role: dev), added by proto-fix/patch.mjs */\nObject.assign(window.__VCFO_ROUTES, ' + JSON.stringify(routes) + ');\n';
  rep('proto.js', "var LEADPG = /(^|\\/)s\\/(lead|mgr|admin|super)\\//.test(String(window.__VPATH || location.pathname));", "var LEADPG = /(^|\\/)s\\/(lead|mgr|admin|super|dev)\\//.test(String(window.__VPATH || location.pathname));");
  rep('proto.js', "SUPPG = /(^|\\/)s\\/super\\//.test(String(window.__VPATH || location.pathname)), PRE = SUPPG ? 'super-' :", "SUPPG = /(^|\\/)s\\/super\\//.test(String(window.__VPATH || location.pathname)), DEVPG = /(^|\\/)s\\/dev\\//.test(String(window.__VPATH || location.pathname)), PRE = DEVPG ? 'dev-' : SUPPG ? 'super-' :");
  rep('proto.js', "var role = SUPPG ? 'super' :", "var role = DEVPG ? 'dev' : SUPPG ? 'super' :");
  rep('proto.js', "['super', 'Super admin']], role, function (v) { if (v === role) return; store.set('role', v); go({ mgr: 'mgr-home', lead: 'lead-home', admin: 'admin-home', super: 'super-home' }[v] || 'home'); }",
    "['super', 'Super admin'], ['dev', 'Developer']], role, function (v) { if (v === role) return; store.set('role', v); go({ mgr: 'mgr-home', lead: 'lead-home', admin: 'admin-home', super: 'super-home', dev: 'dev-home' }[v] || 'home'); }");
  rep('proto.js', "    var h = (here() || '').replace(/^(mgr|admin|super)-/, 'lead-');", "    var h = (here() || '').replace(/^(mgr|admin|super|dev)-/, 'lead-');");
  rep('proto.js', "  var LSIDE = [[/^Overview/, 'lead-home'],", "  var LSIDE = [[/^Overview/, 'lead-home'], [/^Connections/, 'lead-connections'], [/^Messages/, 'lead-messages'], [/^Jobs/, 'lead-jobs'], [/^Logs$/, 'lead-logs'], [/^Deploys$/, 'lead-deploys'], [/^Access$/, 'lead-access'], [/^Data and costs$/, 'lead-data'],");
}

// ---------- 21. No explanations on screen (owner, 23 Oct) ----------
// Lines that explain how to use a card ("darker = more tasks · click a number", "Drag onto the calendar",
// the calendar's footer of rules) go; the controls speak for themselves.
for (const k of Object.keys(T).filter((k) => /^s\/(lead|mgr|admin|super)\/.*\.dc\.html$/.test(k))) {
  repAll(k, /<span class="mut" style="margin-left: auto; font-size: 11\.5px">darker = more tasks · click a number<\/span>/g, '<span style="margin-left: auto"></span>');
  repAll(k, /<span class="mut" style="margin-left: auto; font-size: 11px">Drag onto the calendar<\/span>/g, '');
  repAll(k, /\n\s*<div class="mut" style="display: flex; gap: 14px; flex-wrap: wrap; padding: 10px 16px; border-top: 1px solid #e1e7ef; font-size: 11\.5px">\s*<span>Drag a block’s top or bottom edge[\s\S]*?<\/div>/g, '');
  repAll(k, / ?<span class="mut" style="font-weight: 600; letter-spacing: 0; text-transform: none; font-size: 11px">· click for details<\/span>/g, '');
  repAll(k, /Filing due \(read-only\)/g, 'Filing due');
  if (/darker = more tasks|Drag onto the calendar|Done anywhere = done everywhere|click for details|pick a status to filter/.test(T[k])) fail(k + ': explanation left');
}

// ---------- 22. Client page: a simple header and a tighter timeline (owner, 23 Oct) ----------
// Header keeps the name, the stage, Documents, the contact (and for admins the owners and Reassign), and one
// row of numbers. The back arrow (the top bar has one), Status brief, Board resolution, the SPICe+ ring, the CC
// chips and "Assign a task" go. The timeline takes the dashboards' sizes: 34px rows, 16px bars, 12px titles.
{
  const H2 = 'margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: #0f2a4a';
  for (const k of ['s/lead/Overview.dc.html', 's/mgr/Overview.dc.html', 's/admin/Overview.dc.html', 's/super/Overview.dc.html']) {
    repAll(k, /\n\s*<a href="#" aria-label="Back" style="color: #c9d6e8; font-size: 22px">‹<\/a>/, '');
    rep(k, '<a class="btn" href="#">Status brief</a><a class="btn" href="#">Board resolution</a>', '');
    repAll(k, /<div style="display: flex; flex-direction: column; align-items: center"><div data-donut="spice"[\s\S]*?SPICE\+<\/span><\/div>/, '');
    repAll(k, /\n\s*<span style="margin-left: auto; display: flex; gap: 6px; align-items: center; flex-wrap: wrap"><span class="mono"[^>]*>CC<\/span>[\s\S]*?<\/span>(?=<\/div>)/, '');
    repAll(k, /<button type="button" class="ds-lnk" data-admin-assign="task" data-client="NT" style="color: #9ec5ff">Assign a task<\/button>/, '');
    rep(k, '<span style="color: #c9d6e8; font-size: 12px"> of 14 · 6 of 48 tasks</span>', '<span style="color: #c9d6e8; font-size: 12px"> of 14</span>');
    rep(k, '<h2 class="sg" style="margin: 0; font-size: 18px; font-weight: 600">Timeline · Northwind Technologies</h2>', `<h2 style="${H2}">Timeline</h2>`);
    rep(k, '<b style="font-size: 14px">Steps</b>', `<h2 style="${H2}">Steps</h2>`);
    rep(k, '<a href="#" style="height: 46px; display: flex; align-items: center; font-size: 14px; font-weight: 600; color: #0f2a4a">{{p.l}}</a>', '<a href="#" style="height: 34px; display: flex; align-items: center; font-size: 13px; font-weight: 600; color: #0f2a4a">{{p.l}}</a>');
    rep(k, '<div style="position: relative; height: 46px; border-bottom: 1px dashed #eef2f7">', '<div style="position: relative; height: 34px; border-bottom: 1px dashed #eef2f7">');
    rep(k, "transform:translateY(-50%);height:20px;border-radius:6px;", "transform:translateY(-50%);height:16px;border-radius:6px;");
    if (/Status brief|SPICE\+<\/span>|>CC<|aria-label="Back"/.test(T[k])) fail(k + ': header clutter left');
  }
}

// ---------- 23. Fewer cards on lead and manager Today (owner, 23 Oct: "too many cards") ----------
// Removed because another card already shows the same thing:
//   Timeline · phase bars  = Phase progress (same phases, same clients)
//   Days to COI            = the Days to COI column of Phase progress and the practice row's average
//   Compliance health      = the practice row's Compliances card and Clients × filings
//   Waiting on             = the Client column of Pending with
for (const k of TODAYS) {
  for (const c of ['phase-timeline', 'days-to-coi', 'compliance-health', 'waiting']) {
    const wrapped = new RegExp('\\n?\\s*<sc-if value="\\{\\{show(?:Inc|Cmp)\\}\\}" hint-placeholder-val="\\{\\{true\\}\\}">\\s*<section data-card="' + c + '"[\\s\\S]*?</section>\\s*</sc-if>');
    const plain = new RegExp('\\n?\\s*(?:<!--[^>]*-->\\s*)?<section data-card="' + c + '"[\\s\\S]*?</section>');
    if (wrapped.test(T[k])) T[k] = T[k].replace(wrapped, ''); else if (plain.test(T[k])) T[k] = T[k].replace(plain, ''); else fail(k + ': card ' + c);
    bump(k);
  }
  if (/data-card="(phase-timeline|days-to-coi|compliance-health|waiting)"/.test(T[k])) fail(k + ': repeated card left');
}

// ---------- 24. Lead and manager Today: fewer, denser cards (owner, 23 Oct: "do all the ideas") ----------
// Triage and My to-dos become one Inbox card with two tabs; a triage row shows its actions on hover or focus.
// Stuck steps leaves the right rail and becomes one red mark in the Action queue header.
for (const k of TODAYS) {
  const TRI = /<!-- 12 · shared · triage -->\s*<section data-card="triage" class="card">\s*<div class="ch">[\s\S]*?<\/div>\s*(<sc-for list="\{\{triage\}\}"[\s\S]*?<\/sc-for>)\s*<\/section>\s*<!-- 13 · shared · my to-dos -->\s*<section data-card="todos" class="card">\s*<div class="ch">[\s\S]*?<h2 class="st">My to-dos<\/h2>\s*(<span class="seg"[\s\S]*?<\/span>)<\/div>\s*([\s\S]*?)<\/section>/;
  const m = TRI.exec(T[k]); if (!m) fail(k + ': triage and to-dos');
  const rows = m[1].replace('<div style="padding: 10px 16px; border-top: 1px solid #e1e7ef">', '<div class="tri-row" tabindex="0" style="padding: 8px 16px; border-top: 1px solid #e1e7ef">')
    .replace('<div style="display: flex; gap: 6px; margin-left: 14px">', '<div class="tri-act" style="display: flex; gap: 6px; margin-left: 14px">');
  if (!rows.includes('tri-row') || !rows.includes('tri-act')) fail(k + ': triage row');
  T[k] = T[k].replace(m[0], '<!-- 12 + 13 · inbox: triage and my to-dos in one card -->\n          <section data-card="inbox" data-inbox="triage" class="card">\n'
    + '            <div class="ch"><h2 class="st">Inbox</h2><span class="ds-tabs" role="tablist" aria-label="Inbox"><button type="button" role="tab" data-inbox-tab="triage" aria-selected="true">Triage <b>{{triageN}}</b></button><button type="button" role="tab" data-inbox-tab="todos" aria-selected="false">My to-dos <b>{{todoN}}</b></button></span></div>\n'
    + '            <div data-inbox-pane="triage">' + rows + '</div>\n'
    + '            <div data-inbox-pane="todos"><div style="display: flex; padding: 0 16px 8px">' + m[2] + '</div>' + m[3] + '</div>\n          </section>');
  const STU = /\s*<!-- 14 · incorporation only · stuck steps -->\s*<sc-if value="\{\{showInc\}\}" hint-placeholder-val="\{\{true\}\}">\s*<section data-card="stuck"[\s\S]*?<\/section>\s*<\/sc-if>/;
  if (!STU.test(T[k])) fail(k + ': stuck card'); T[k] = T[k].replace(STU, '');
  const QH = /(<h2 class="st">Action queue<\/h2><span class="chip"[^>]*>\{\{qCount\}\}<\/span>)/;
  if (!QH.test(T[k])) fail(k + ': action queue header');
  T[k] = T[k].replace(QH, '$1<sc-if value="{{showInc}}" hint-placeholder-val="{{true}}"><sc-for list="{{stuckTop}}" as="s" hint-placeholder-count="1"><a href="#" data-go="lead-step" class="ds-stuck" title="{{s.c}} · waiting {{s.d}}">{{stuckN}} stuck · {{s.t}}</a></sc-for></sc-if>');
  const RV = /triageN: triAll\.length, todos,/;
  if (!RV.test(T[k])) fail(k + ': inbox values');
  T[k] = T[k].replace(RV, 'triageN: triAll.length, todos, todoN: todos.filter(t => !t.done).length, stuckTop: stuck.slice(0, 1),');
  bump(k);
  if (/data-card="(triage|todos|stuck)"/.test(T[k])) fail(k + ': merged card left');
}

// ---------- 25. Manager Today: approvals and reviews waiting for the manager, at the top of the right rail ----------
T['s/mgr/Approvals.dc.html'] = readFileSync(join(here, 'shared', 'Approvals.dc.html'), 'utf8');
for (const k of TODAYS.filter(k => k.startsWith('s/mgr/'))) {
  rep(k, '        <!-- right rail -->\n        <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">',
    '        <!-- right rail -->\n        <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">\n          <dc-import name="Approvals" mgr="pranay" hint-size="100%,200px"></dc-import>');
}

// ---------- 26. Client home: one next action under the greeting, a Fees card, and no "Who holds it now" ----------
// "Who holds it now" and its "Steps around Northwind" list repeat the timeline and the steps card above them.
for (const n of ['v7c_today']) T['s/home/' + n + '.dc.html'] = readFileSync(join(here, 'shared', n + '.dc.html'), 'utf8');
for (const [k, greet, after] of [['s/home/v7_before.dc.html', 'v7c_greet_b', '0'], ['s/home/v7_after.dc.html', 'v7c_greet_a', '1']]) {
  const g = new RegExp('(<div style="animation-delay:[\\d.]+s"><dc-import name="' + greet + '"[^>]*></dc-import></div>)');
  if (!g.test(T[k])) fail(k + ': greeting'); T[k] = T[k].replace(g, `$1<div style="animation-delay:0.06s"><dc-import name="v7c_today" after="${after}" hint-size="100%,56px" style="display:block;width:100%"></dc-import></div>`);
  bump(k);
}
{
  // "Who holds it now" leaves; the Fees card was removed on 26 Oct (owner: no money on any dashboard).
  const k = 's/home/v7_before.dc.html', cur = /<div style="animation-delay:[\d.]+s"><dc-import name="v7c_current"[^>]*><\/dc-import><\/div>/;
  if (!cur.test(T[k])) fail(k + ': who holds it now');
  T[k] = T[k].replace(cur, '');
}

// ---------- 27. Client home, 26 Oct: Steps bars aligned, Phase 4 leaves, two independent columns ----------
for (const k of ['s/home/v7c_steps_b.dc.html', 's/home/v7c_steps_a.dc.html']) {
  // The phase word after each count chip varied in width, so the chips did not line up; the chip says it all.
  repAll(k, /<\/span><span class="mono cap">(?:done|in progress|upcoming)<\/span><\/summary>/g, '</span></summary>');
  repAll(k, /min-width:116px;justify-content:center">(\d+ of \d+)<\/span><\/summary>/g, 'width:116px;justify-content:center;flex:none">$1</span></summary>');
  // Registrations are their own page now: incorporation ends at Phase 3.
  const i = T[k].indexOf('data-go="inc-phase-4"'); if (i < 0) fail(k + ': phase 4');
  const a = T[k].lastIndexOf('<details class="stp-g"', i), b = T[k].indexOf('</details>', i) + '</details>'.length;
  T[k] = T[k].slice(0, a) + T[k].slice(b); bump(k);
  if (/class="mono cap">(done|in progress|upcoming)</.test(T[k])) fail(k + ': phase words left');
}
{
  // Rows of a shared grid made the left column wait for the taller right one. The areas below the
  // timeline now sit in two stacks that grow on their own: left wide, right 360px; one column below 1180px.
  const COLS = { 's/home/v7_before.dc.html': [['a', 'c2'], ['c1', 'b']], 's/home/v7_after.dc.html': [['a1', 'f'], ['c1', 'a2', 'c2', 'd', 'e']] };
  // The registrations table now lives on the Registrations page.
  { const k = 's/home/v7_after.dc.html', re = /<div style="animation-delay:[\d.]+s"><dc-import name="v7c_reg"[^>]*><\/dc-import><\/div>/; if (!re.test(T[k])) fail(k + ': registrations table'); T[k] = T[k].replace(re, ''); }
  const take = (k, area) => {
    const open = '<div class="stag" style="grid-area:' + area + '">', i = T[k].indexOf(open); if (i < 0) fail(k + ': area ' + area);
    let depth = 0, j = i; const re = /<div\b|<\/div>/g; re.lastIndex = i;
    for (let m; (m = re.exec(T[k]));) { depth += m[0] === '</div>' ? -1 : 1; if (!depth) { j = m.index + 6; break; } }
    const html = T[k].slice(i, j); T[k] = T[k].slice(0, i) + T[k].slice(j); return html;
  };
  for (const [k, [L, R]] of Object.entries(COLS)) {
    const left = L.map((x) => take(k, x)).join(''), right = R.map((x) => take(k, x)).join('');
    const t = '<div class="stag" style="grid-area:t">', i = T[k].indexOf(t); if (i < 0) fail(k + ': area t');
    let depth = 0, j = i; const re = /<div\b|<\/div>/g; re.lastIndex = i;
    for (let m; (m = re.exec(T[k]));) { depth += m[0] === '</div>' ? -1 : 1; if (!depth) { j = m.index + 6; break; } }
    T[k] = T[k].slice(0, j) + '<div class="vh-cols"><div class="vh-l">' + left + '</div><div class="vh-r">' + right + '</div></div>' + T[k].slice(j);
    const st = '</style><main class="vh-main';
    if (!T[k].includes(st)) fail(k + ': grid style');
    T[k] = T[k].replace(st, `
.vh-b,.vh-a{grid-template-areas:"g" "t" "x" !important;grid-template-columns:minmax(0,1fr) !important;grid-template-rows:auto !important}
.vh-cols{grid-area:x;display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start;min-width:0}
@media (min-width:1180px){.vh-cols{grid-template-columns:minmax(0,1fr) 360px}}
.vh-l,.vh-r,.vh-l>.stag,.vh-r>.stag{display:flex;flex-direction:column;gap:16px;min-width:0}
` + st);
    bump(k);
  }
}

// ---------- 28. Greeting numbers move to a white strip under the navy band (lead and manager Today) ----------
for (const k of TODAYS) {
  rep(k, '<div style="display: flex; flex-wrap: wrap">\n          <sc-for list="{{kpis}}"', '<div class="gk" style="display: flex; flex-wrap: wrap">\n          <sc-for list="{{kpis}}"');
}

// ---------- 29. "Nudge" is not a professional word (owner, 26 Oct): reminders everywhere ----------
// Only words people read change; code names (x.nudge, wa_nudges, doc_nudge_hi_en) stay.
{
  const WORDS = [[/>Nudge<\/button>/g, '>Remind</button>'], [/'Nudge'/g, "'Remind'"], [/'Nudge · /g, "'Reminder · "], [/'Nudge due'/g, "'Reminder due'"],
    [/'Nudge Northwind'/g, "'Remind Northwind'"], [/Nudge client/g, 'Send reminder'], [/'Nudged '/g, "'Reminder sent to '"], [/Utility bill nudge/g, 'Utility bill reminder'],
    [/Utility nudge/g, 'Utility reminder'], [/WhatsApp nudges/g, 'WhatsApp reminders'], [/WhatsApp nudge/g, 'WhatsApp reminder'], [/Document request nudge/g, 'Document request reminder'],
    [/nudges retry/g, 'reminders retry'], [/no nudges /g, 'no reminders '], [/a quick nudge/g, 'a quick reminder']];
  for (const k of Object.keys(T)) {
    if (!/\.(html|js)$/.test(k) || !/nudg/i.test(T[k])) continue;
    let s = T[k]; for (const [re, to] of WORDS) s = s.replace(re, to);
    if (s !== T[k]) { T[k] = s; bump(k); }
    if (/Nudg| nudge|nudges /.test(T[k].replace(/(?:x|t|r)\.nudge|nudge:|, nudge\]|!!nudge|wa_nudges|doc_nudge_hi_en/g, ''))) fail(k + ': a "nudge" word is left');
  }
}

// ---------- 30. Lead and manager Today, nine blocks to five (owner, 26 Oct: "apply all") ----------
// Gone: This week (the Action queue has Due today and Upcoming), Pending with (same items as the queue; its
// client part becomes "Waiting on client" in the rail), Client health (Phase progress and the queue show it).
// The practice row shrinks to a strip of three numbers; Phase progress drops the Registration column
// (registrations are their own page); Clients × filings keeps only clients with an overdue or due-soon filing.
for (const k of TODAYS) {
  for (const c of ['week', 'ball', 'client-health']) {
    const wrapped = new RegExp('\\n?\\s*(?:<!--[^>]*-->\\s*)?<sc-if value="\\{\\{show(?:Inc|Cmp)\\}\\}" hint-placeholder-val="\\{\\{true\\}\\}">\\s*<section data-card="' + c + '"[\\s\\S]*?</section>\\s*</sc-if>');
    const plain = new RegExp('\\n?\\s*(?:<!--[^>]*-->\\s*)?<section data-card="' + c + '"[\\s\\S]*?</section>');
    if (wrapped.test(T[k])) T[k] = T[k].replace(wrapped, ''); else if (plain.test(T[k])) T[k] = T[k].replace(plain, ''); else fail(k + ': card ' + c);
  }
  rep(k, '<dc-import name="Practice" scope="pranay" hint-size="100%,280px"></dc-import>', '<dc-import name="Practice" scope="pranay" slim="1" hint-size="100%,56px"></dc-import>');
  rep(k, '<span>PART A</span><span>PART B</span><span>POST-INC.</span><span>REGISTRATION</span>', '<span>PART A</span><span>PART B</span><span>POST-INC.</span>');
  repAll(k, /(<span style="display: grid; grid-template-columns: )repeat\(4, minmax\(0, 1fr\)\)(; gap: 6px(?:; text-align: center)?">(?:<span>PART A|<sc-for list="\{\{r\.grp\}\}"))/g, '$1repeat(3, minmax(0, 1fr))$2');
  rep(k, "r.grp = kinds.split('').map(", "r.grp = kinds.split('').slice(0, 3).map(");
  rep(k, 'const grid = cmpKeys.map(', 'const grid = cmpKeys.filter(k => /[od]/.test(FR[k])).map(');
  // Waiting on client, under the Inbox, so the rail is as tall as the queue.
  const ib = T[k].indexOf('<section data-card="inbox"'); if (ib < 0) fail(k + ': inbox');
  const ie = T[k].indexOf('</section>', ib) + '</section>'.length;
  T[k] = T[k].slice(0, ie) + `
          <section data-card="waiting-client" class="card">
            <div class="ch"><h2 class="st">Waiting on client</h2><span class="chip">{{waitCN}}</span></div>
            <sc-for list="{{waitClient}}" as="w" hint-placeholder-count="3"><div style="display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-top: 1px solid #e1e7ef"><i style="{{w.dot}}"></i><span style="flex: 1; min-width: 0"><b style="display: block; font-weight: 600; font-size: 12.5px">{{w.t}}</b><span class="mut" style="font-size: 11.5px">{{w.c}} · {{w.age}}</span></span><button type="button" class="btn" style="height: 26px" onClick="{{w.go}}">Remind</button></div></sc-for>
          </section>` + T[k].slice(ie);
  rep(k, 'stuckTop: stuck.slice(0, 1),', "stuckTop: stuck.slice(0, 1), waitClient: waitAll.filter(w => /^Client/.test(w[4])).map(([kk, , t, c, who]) => ({ t, c, age: who.replace('Client ', '') + ' waiting', dot: dot(kk), go: () => { if (window.vcfoToast) window.vcfoToast('Reminder sent to ' + CL[kk][0].split(' ')[0] + ' · ' + t); } })), waitCN: waitAll.filter(w => /^Client/.test(w[4])).length,");
  bump(k);
  if (/data-card="(week|ball|client-health)"/.test(T[k])) fail(k + ': removed card left');
}

// ---------- 31. Manager Team tasks: checkbox and status icon instead of status words (owner, 26 Oct) ----------
for (const k of TODAYS.filter(k => k.startsWith('s/mgr/'))) {
  if (!T[k].includes('data-card="team-tasks"')) continue;
  rep(k, '<thead><tr><th>Task</th><th>Company</th><th>Status</th></tr></thead>', '<thead><tr><th></th><th>Task</th><th>Company</th><th>Due</th></tr></thead>');
  rep(k, '<tr><td><b style="display: block; font-size: 12.5px">{{r.task}}</b>', '<tr><td class="tk"><input type="checkbox" aria-label="Mark {{r.task}} done" checked="{{r.done}}"><span class="tsi" data-s="{{r.sk}}" title="{{r.st}}"></span></td><td><b style="display: block; font-size: 12.5px">{{r.task}}</b>');
  rep(k, '<td><span class="chip" style="{{r.cs}}">{{r.st}}</span></td></tr>', '<td style="{{r.dueSt}}; white-space: nowrap">{{r.due}}</td></tr>');
  rep(k, "sub: r.plead + ' · due ' + r.due,", "sub: r.plead, due: r.due, dueSt: r.st === 'bad' ? 'color:#b5302a;font-weight:600' : '', sk: { bad: 'run', due: 'none' }[r.st] || r.st, done: r.st === 'done',");
}

// ---------- 32. Registrations and Obligations pages, client and staff (owner, 26 Oct) ----------
// One list component (Register) and one detail component (Item) serve both, for the client and for staff.
// Registrations leave incorporation (Phase 4) and get their own sidebar item; Obligations joins
// Compliances as its third page (Calendar · Filings · Obligations).
{
  const SH = join(here, 'shared');
  const CAT = readFileSync(join(SH, 'regcat.js'), 'utf8'), REG = readFileSync(join(SH, 'Register.dc.html'), 'utf8'), ITEM = readFileSync(join(SH, 'Item.dc.html'), 'utf8');
  T['s/lead/regcat.js'] = CAT; for (const d of ['home', 'mgr', 'admin', 'super']) D.alias[`s/${d}/regcat.js`] = 's/lead/regcat.js';
  for (const d of ['home', 'lead', 'mgr', 'admin']) { T[`s/${d}/Register.dc.html`] = REG; T[`s/${d}/Item.dc.html`] = ITEM; }
  const staffPage = (d, label, title, active, sub, crumb, comp, kind) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${label} · ${title}</title>
<script src="./support.js"></script>
<script src="./data.js"></script>
<script src="./regcat.js"></script>
</head>
<body>
<x-dc>
<div class="L" style="display: flex; flex-wrap: wrap; min-height: 100vh; position: relative; background: #f4f6f9">
  <div style="flex: 1 1 248px; max-width: 248px; background: #0f2a4a"><dc-import name="Side" active="${active}" sub="${sub}" mode="{{mode}}" hint-size="248px,1000px"></dc-import></div>
  <div style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column">
    <dc-import name="Top" crumb="${crumb}" mode="{{mode}}" on-mode="{{setMode}}" hint-size="100%,56px"></dc-import>
    <main style="max-width: 1400px; width: 100%; margin: 0 auto; padding: 18px clamp(12px, 2vw, 28px) 110px; box-sizing: border-box">
      <dc-import name="${comp}" kind="${kind}" who="staff" hint-size="100%,1200px" style="display: block; width: 100%"></dc-import>
    </main>
  </div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":1200}}'>
class Component extends DCLogic {
  renderVals() { const s = this.state || {}; return { mode: s.mode || 'mixed', setMode: (m) => this.setState({ mode: m }) }; }
}
</script>
<script src="../../routes.js"></script><script src="../../proto.js"></script>
</body>
</html>
`;
  const PAGES = [['registrations', 'Registrations', 'Registrations', 'registrations', '', 'Today › Registrations', 'Register', 'reg'],
    ['registration', 'RegItem', 'Registration', 'registrations', '', 'Today › Registrations › Registration', 'Item', 'reg'],
    ['obligations', 'Obligations', 'Compliances · Obligations', 'compliances', 'Obligations', 'Today › Compliances › Obligations', 'Register', 'ob'],
    ['obligation', 'ObItem', 'Obligation', 'compliances', 'Obligations', 'Today › Compliances › Obligations › Obligation', 'Item', 'ob']];
  const LBL = { lead: 'Lead', mgr: 'Manager', admin: 'Admin' };
  for (const d of ['lead', 'mgr', 'admin']) {
    const routes = {};
    for (const [r, f, t, act, sub, crumb, comp, kind] of PAGES) {
      T[`s/${d}/${f}.dc.html`] = staffPage(d, LBL[d], t, act, sub, crumb, comp, kind);
      routes[`${d}-${r}`] = { d: `s/${d}/${f}.dc.html`, t: `${LBL[d]} · ${t}`, role: d };
    }
    T['routes.js'] += `\n/* round 3: ${LBL[d]} registrations and obligations, added by proto-fix/patch.mjs */\nObject.assign(window.__VCFO_ROUTES, ` + JSON.stringify(routes) + ');\n';
    // Sidebar: Registrations after Clients; Obligations under Compliances.
    const S = `s/${d}/Side.dc.html`;
    const before = T[S];
    T[S] = T[S].replace(/(\['clients', 'Clients', '(?:8|14)'(?:, 'g')?\],\s*)/, "$1['registrations', 'Registrations'], ");
    T[S] = T[S].replace(/(const P = \{\n)/, "$1      registrations: 'M9 12l2 2 4-4 M12 2.5l2.3 1.7 2.9-.2.9 2.8 2.4 1.6-.9 2.7.9 2.7-2.4 1.6-.9 2.8-2.9-.2L12 21.5l-2.3-1.7-2.9.2-.9-2.8-2.4-1.6.9-2.7-.9-2.7 2.4-1.6.9-2.8 2.9.2Z',\n");
    T[S] = T[S].replace("compliances: ['Calendar', 'Filings']", "compliances: ['Calendar', 'Filings', 'Obligations']");
    if (T[S] === before || !T[S].includes("['registrations', 'Registrations']") || !T[S].includes("registrations: 'M9") || !T[S].includes("'Obligations']")) fail(S + ': sidebar items');
    bump(S);
  }
  rep('proto.js', "[/^Registrations$/, 'lead-registrations'], ", "[/^Registrations$/, 'lead-registrations'], [/^Obligations$/, 'lead-obligations'], ");
  // Client pages: the shared navy sidebar (shell.js) gains Registrations and Obligations.
  rep('shell.js', "    { k: 'incorporation', t: 'Incorporation', i: 'building-2', badge: 'inc' },", "    { k: 'incorporation', t: 'Incorporation', i: 'building-2', badge: 'inc' },\n    { k: 'registrations', t: 'Registrations', i: 'badge-check' },");
  rep('shell.js', "kids: [{ k: 'compliances', t: 'Calendar' }, { k: 'filings', t: 'Filings' }] }", "kids: [{ k: 'compliances', t: 'Calendar' }, { k: 'filings', t: 'Filings' }, { k: 'obligations', t: 'Obligations' }] }");
  rep('shell.js', "  var ALIAS = { ", "  var ALIAS = { 'registration': 'registrations', 'obligation': 'obligations', ");
  rep('shell.js', '  var LU = {\n', '  var LU = {\n    "badge-check": "<path d=\\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\\"/><path d=\\"m9 12 2 2 4-4\\"/>",\n');
  const clientPage = (title, crumbs, comp, kind) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
<script src="./regcat.js"></script>
</head>
<body>
<x-dc>
<helmet><style>body{margin:0;background:#f3f5f9;font-family:Roboto,Public Sans,system-ui,sans-serif}
.cpg{display:flex;min-height:100vh}
.cpg-side{width:var(--vp-side-w,248px);flex:none}
.cpg-top{height:52px;display:flex;align-items:center;gap:10px;padding:0 20px;border-bottom:1px solid #e1e7ef;background:#fff;font-size:13px;color:#0f2a4a}
.cpg-top ol{display:flex;gap:6px;margin:0;padding:0;list-style:none}
.cpg-top li+li::before{content:"›";margin-right:6px;color:#8593a6}
.cpg-top li[aria-current]{font-weight:600}
</style></helmet>
<div class="cpg">
  <aside class="cpg-side" data-vp="side" aria-hidden="true"></aside>
  <div style="flex: 1; min-width: 0">
    <header class="cpg-top"><nav aria-label="Location"><ol>${crumbs.map((c, i) => i === crumbs.length - 1 ? `<li aria-current="page">${c}</li>` : `<li>${c}</li>`).join('')}</ol></nav></header>
    <main style="max-width: 1400px; margin: 0 auto; padding: 20px clamp(12px, 2vw, 28px) 110px; box-sizing: border-box">
      <dc-import name="${comp}" kind="${kind}" who="client" hint-size="100%,1200px" style="display: block; width: 100%"></dc-import>
    </main>
  </div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":1200}}'>
class Component extends DCLogic { renderVals() { return {}; } }
</script>
<script src="../../routes.js"></script><script src="../../proto.js"></script>
</body>
</html>
`;
  const CR = { registrations: ['Registrations', ['Home', 'Registrations'], 'Register', 'reg'], registration: ['Registration', ['Home', 'Registrations', 'Registration'], 'Item', 'reg'],
    obligations: ['Obligations', ['Home', 'Compliances', 'Obligations'], 'Register', 'ob'], obligation: ['Obligation', ['Home', 'Compliances', 'Obligations', 'Obligation'], 'Item', 'ob'] };
  const croutes = {};
  for (const [r, [t, cr, comp, kind]] of Object.entries(CR)) { const f = `s/home/v7p_${r}.dc.html`; T[f] = clientPage(t, cr, comp, kind); croutes[r] = { d: f, t: 'Client · ' + t }; }
  T['routes.js'] += '\n/* round 3: client registrations and obligations, added by proto-fix/patch.mjs */\nObject.assign(window.__VCFO_ROUTES, ' + JSON.stringify(croutes) + ');\n';
}

// ---------- 33. Settings move into Profile (owner, 26 Oct: "put everything in profile itself") ----------
// The account row at the foot of every sidebar opens Profile; personal settings live there. Firm-wide
// settings stay with the admin and super admin as "Firm settings".
{
  const PROF = readFileSync(join(here, 'shared', 'Profile.dc.html'), 'utf8');
  const tail = '<script src="../../routes.js"></script><script src="../../proto.js"></script>';
  const LBL = { lead: 'Lead', mgr: 'Manager', admin: 'Admin', super: 'Super admin', dev: 'Developer' };
  const routes = {};
  for (const d of ['lead', 'mgr', 'admin', 'super', 'dev']) {
    T[`s/${d}/Profile.dc.html`] = PROF;
    T[`s/${d}/ProfilePage.dc.html`] = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${LBL[d]} · Profile</title>
<script src="./support.js"></script>
<script src="./data.js"></script>
</head>
<body>
<x-dc>
<div class="L" style="display: flex; flex-wrap: wrap; min-height: 100vh; position: relative; background: #f4f6f9">
  <div style="flex: 1 1 248px; max-width: 248px; background: #0f2a4a"><dc-import name="Side" active="profile" mode="{{mode}}" hint-size="248px,1000px"></dc-import></div>
  <div style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column">
    <dc-import name="Top" crumb="${d === 'super' || d === 'dev' ? 'Overview' : 'Today'} › Profile" mode="{{mode}}" on-mode="{{setMode}}" hint-size="100%,56px"></dc-import>
    <main style="max-width: 1200px; width: 100%; margin: 0 auto; padding: 18px clamp(12px, 2vw, 28px) 110px; box-sizing: border-box">
      <dc-import name="Profile" who="${d}" hint-size="100%,800px" style="display: block; width: 100%"></dc-import>
    </main>
  </div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic {
  renderVals() { const s = this.state || {}; return { mode: s.mode || 'mixed', setMode: (m) => this.setState({ mode: m }) }; }
}
</script>
${tail}
</body>
</html>
`;
    routes[`${d}-profile`] = { d: `s/${d}/ProfilePage.dc.html`, t: `${LBL[d]} · Profile`, role: d };
    const S = `s/${d}/Side.dc.html`, before = T[S];
    T[S] = T[S].replace(/(<div style="display: flex; align-items: center; gap: 10px; padding: 10px 0 0; border-top: 1px solid rgba\(255,255,255,\.1\); color: #fff)"/, '$1; cursor: pointer" data-go="lead-profile" title="Your profile"');
    if (d === 'lead' || d === 'mgr') T[S] = T[S].replace("items.push(['analytics', 'Analytics'], ['audit', 'Audit'], ['settings', 'Settings']);", "items.push(['analytics', 'Analytics'], ['audit', 'Audit']);");
    if (d === 'admin' || d === 'super') T[S] = T[S].replace("['settings', 'Settings']", "['settings', 'Firm settings']");
    if (T[S] === before || !T[S].includes('data-go="lead-profile"') || (d !== 'dev' && /\['settings', 'Settings'\]/.test(T[S]))) fail(S + ': profile or settings');
    bump(S);
  }
  T['routes.js'] += '\n/* round 3: Profile on every portal, added by proto-fix/patch.mjs */\nObject.assign(window.__VCFO_ROUTES, ' + JSON.stringify(routes) + ');\n';
  rep('proto.js', "[/^Registrations$/, 'lead-registrations'], ", "[/^Registrations$/, 'lead-registrations'], [/^Firm settings$/, 'lead-settings'], ");
  // Client: Settings leaves the sidebar; the account menu opens Profile.
  T['s/home/Profile.dc.html'] = PROF;
  T['s/home/v7p_profile.dc.html'] = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Profile</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet><style>body{margin:0;background:#f3f5f9;font-family:Roboto,Public Sans,system-ui,sans-serif}
.cpg{display:flex;min-height:100vh}.cpg-side{width:var(--vp-side-w,248px);flex:none}
.cpg-top{height:52px;display:flex;align-items:center;padding:0 20px;border-bottom:1px solid #e1e7ef;background:#fff;font-size:13px;color:#0f2a4a}
.cpg-top ol{display:flex;gap:6px;margin:0;padding:0;list-style:none}.cpg-top li+li::before{content:"›";margin-right:6px;color:#8593a6}.cpg-top li[aria-current]{font-weight:600}</style></helmet>
<div class="cpg">
  <aside class="cpg-side" data-vp="side" aria-hidden="true"></aside>
  <div style="flex: 1; min-width: 0">
    <header class="cpg-top"><nav aria-label="Location"><ol><li>Home</li><li aria-current="page">Profile</li></ol></nav></header>
    <main style="max-width: 1200px; margin: 0 auto; padding: 20px clamp(12px, 2vw, 28px) 110px; box-sizing: border-box"><dc-import name="Profile" who="client" hint-size="100%,800px" style="display: block; width: 100%"></dc-import></main>
  </div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic { renderVals() { return {}; } }
</script>
${tail}
</body>
</html>
`;
  T['routes.js'] += '\nObject.assign(window.__VCFO_ROUTES, ' + JSON.stringify({ profile: { d: 's/home/v7p_profile.dc.html', t: 'Client · Profile' } }) + ');\n';
  rep('shell.js', ",\n    { k: 'settings', t: 'Settings', i: 'settings' }\n  ];", "\n  ];");
  rep('shell.js', `'<button type="button" role="menuitem" data-go="settings">' + lu('settings') + 'Settings</button>`, `'<button type="button" role="menuitem" data-go="profile">' + lu('user-round') + 'Profile</button>`);
}

// ---------- 34. Staff Vault uses the client Documents explorer (owner, 26 Oct) ----------
// Same toolbar (filter, Status, Replaced, By step / By category, Download all, Upload), folder tree and
// preview pane; staff pick the client from a dropdown, the first control.
{
  const SRC = T['s/docs/docs_a_refined.dc.html']; if (!SRC) fail('client documents explorer');
  for (const d of ['lead', 'mgr', 'admin']) {
    let v = SRC;
    const side = /<div class="vp-sidecol" data-vp="side"[^>]*><dc-import name="side"[^>]*><\/dc-import><\/div>/;
    if (!side.test(v)) fail(d + ' vault: side'); v = v.replace(side, '<div style="flex: none; width: 248px; background: #0f2a4a"><dc-import name="Side" active="docs" sub="Vault" mode="mixed" hint-size="248px,1000px"></dc-import></div>');
    const top = /<dc-import name="topbar"[^>]*><\/dc-import>/;
    if (!top.test(v)) fail(d + ' vault: top'); v = v.replace(top, `<dc-import name="Top" crumb="${d === 'admin' ? 'Today' : 'Today'} › Docs › Vault" mode="mixed" hint-size="100%,56px"></dc-import>`);
    v = v.replace(/<dc-import name="v7c_bot"[^>]*><\/dc-import>/g, '');
    v = v.replace(/href="docs_(?:upload|a_drill)\.dc\.html"/g, 'href="#"');
    const tools = '<div class="vdoc-tools">';
    if (!v.includes(tools)) fail(d + ' vault: toolbar');
    v = v.replace(tools, tools + '<select data-vault-client aria-label="Client" style="height:34px;border:1px solid var(--border,#d5dce6);border-radius:8px;padding:0 10px;font:600 13px inherit;font-family:inherit;color:var(--fg,#0f2a4a);background:var(--panel,#fff)"><option>Northwind Technologies</option><option>Orchid Lane Foods</option><option>Larkspur Analytics</option><option>Juniper Bio</option><option>Brightwave Robotics</option><option>Tidewater Logistics</option><option>Kestrel Health</option><option>Halcyon Fintech</option></select>');
    v = v.replace(/<title>[^<]*<\/title>/, `<title>${{ lead: 'Lead', mgr: 'Manager', admin: 'Admin' }[d]} · Vault</title>`);
    T[`s/${d}/Vault.dc.html`] = v; bump(`s/${d}/Vault.dc.html`);
  }
}

// ---------- 35. Inbox: a new item slides in at the top (owner pick, 26 Oct) ----------
for (const k of TODAYS) {
  rep(k, '<div class="tri-row" tabindex="0" style="padding: 8px 16px; border-top: 1px solid #e1e7ef">', '<div class="tri-row {{t.nc}}" tabindex="0" style="padding: 8px 16px; border-top: 1px solid #e1e7ef">');
  rep(k, "const triage = triAll.slice(0, 3).map(([k, , t, from, c, when]) => ({ t, from, when, dot: 'width:8px;height:8px;border-radius:99px;flex:none;display:inline-block;background:' + c }));",
    "if (!this.__ni) { this.__ni = 1; setTimeout(() => this.setState({ niTick: 1 }), 4500); }\n    const triage = (this.state && this.state.niTick ? [['NT', 'any', 'Rohan uploaded the stamped rent agreement', 'Northwind · client upload', '#1b4f94', 'Now', 1]] : []).concat(triAll).slice(0, 3).map(([k, , t, from, c, when, nw]) => ({ t, from, when, nc: nw ? 'nw' : '', dot: 'width:8px;height:8px;border-radius:99px;flex:none;display:inline-block;background:' + c }));");
}

// ---------- 36. Ask VCFO opens on a prompt home with quick-start chips (owner pick, 26 Oct; Manus style) ----------
rep('proto.js', `    box.innerHTML = '<div class="vpc-m vpc-a">Hello. Ask me anything about Northwind’s setup, or pick a question below.</div>' + l.map(function (m) {`,
  `    win.classList.toggle('vpc-home', !l.length);
    if (!l.length) { box.innerHTML = '<div class="vpc-hm"><b>What can I do for you?</b><span>Ask about Northwind, or start with one of these.</span><div class="vpc-hc">' + ['What is due this week?', 'Draft a reminder to Rohan', 'Explain a GST notice', 'Prepare the GST checklist'].map(function (q) { return '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div></div>'; setMood(); return; }
    box.innerHTML = '<div class="vpc-m vpc-a">Hello. Ask me anything about Northwind’s setup, or pick a question below.</div>' + l.map(function (m) {`);
rep('proto.js', "    '#vp-chat .vpc-sg{display:flex;", "    '#vp-chat.vpc-home .vpc-sg{display:none}#vp-chat .vpc-hm{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:28px 18px 10px}#vp-chat .vpc-hm b{font:600 18px Public Sans,system-ui,sans-serif}#vp-chat .vpc-hm span{font-size:12.5px;color:#4b5b70}#vp-chat .vpc-hc{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:10px}#vp-chat .vpc-hc button{min-height:34px;padding:4px 12px;border-radius:999px;border:1px solid #c9d3df;background:#fff;color:#0f2a4a;font:600 12.5px Public Sans,system-ui,sans-serif;cursor:pointer}#vp-chat .vpc-hc button:hover{border-color:#1b4f94;color:#1b4f94}',\n    '#vp-chat .vpc-sg{display:flex;");

// ---------- 37. Library shelf: the SBC SOPs are books; spines slide in; the hovered book comes forward (owner, 26 Oct) ----------
{
  const k = 's/docs/lib_shelf_a.dc.html';
  rep(k, "      ['Northwind’s project', 'Northwind’s project', 'var(--navy)', 'M5 21V4 M5 4h11l-2 4 2 4H5']\n    ];",
    "      ['Northwind’s project', 'Northwind’s project', 'var(--navy)', 'M5 21V4 M5 4h11l-2 4 2 4H5'],\n      ['SBC SOPs', 'SOP', 'oklch(40% 0.1 160)', 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z']\n    ];");
  rep(k, "      [4, 'What happens after the COI?'], [4, 'Reading Northwind’s monthly status brief']\n    ];",
    "      [4, 'What happens after the COI?'], [4, 'Reading Northwind’s monthly status brief'],\n      " + ['GST registration', 'CLRA registration', 'EPF registration', 'ESI registration', 'IEC registration', 'Labour Welfare Fund', 'Legal Entity Identifier', 'Letter of undertaking', 'Non-STPI registration', 'POSH compliance', 'Professional tax', 'Shops and Establishment', 'Trade licence', 'Trademark registration', 'Due dates: monthly, quarterly, annual'].map(t => `[5, '${t}']`).join(', ') + "\n    ];");
  rep(k, "    const L = ['All', 'Incorporation', 'Foreign inv.', 'Tax', 'Compliance', 'Northwind’s project'];", "    const L = ['All', 'Incorporation', 'Foreign inv.', 'Tax', 'Compliance', 'Northwind’s project', 'SBC SOPs'];");
  const css = '</style>';
  const i = T[k].indexOf(css); if (i < 0) fail(k + ': style');
  T[k] = T[k].slice(0, i) + `
/* round 3: spines slide in one after another; the hovered book comes forward, the rest dim */
.shelf .book{animation:bkin .5s cubic-bezier(.22,1,.36,1) both}
.shelf .book:nth-child(2){animation-delay:.06s}.shelf .book:nth-child(3){animation-delay:.12s}.shelf .book:nth-child(4){animation-delay:.18s}.shelf .book:nth-child(5){animation-delay:.24s}.shelf .book:nth-child(n+6){animation-delay:.3s}
@keyframes bkin{from{transform:translate3d(-18px,0,0);opacity:0}}
.shelf:hover .book{opacity:.45}.shelf .book:hover,.shelf .book:focus-visible{opacity:1}
.book{transition:transform .42s cubic-bezier(.34,1.45,.5,1),box-shadow .3s,opacity .2s}
@media (prefers-reduced-motion:reduce){.shelf .book{animation:none}.shelf:hover .book{opacity:1}}
` + T[k].slice(i); bump(k);
}

// ---------- 38. Email: signatures come from Outlook (owner, 26 Oct; SBC runs a server-side signature tool) ----------
for (const d of ['lead', 'mgr', 'admin', 'super']) {
  const k = `s/${d}/Email.dc.html`; if (!T[k]) continue;
  repAll(k, /(Please upload them on your Incorporation page\. Thanks,<br>[A-Za-z]+<\/p>)/, '$1\n            <p class="ds-sig" style="margin: 14px 0 0; padding-top: 10px; border-top: 1px dashed #c9d3df; color: #8593a6; font-size: 12px">Your Outlook signature and the SBC footer are added when this is sent.</p>');
  if (!T[k].includes('ds-sig')) fail(k + ': signature line');
  rep(k, 'Outlook connected</span><a href="#" style="font-size: 12px; font-weight: 700">Settings</a>', 'Outlook connected</span><span class="chip" style="background: #eef2f7; color: #4b5b70">Signature from Outlook · server-side signature on</span><a href="#" data-go="lead-profile" style="font-size: 12px; font-weight: 700">Profile › Email</a>');
}

// ---------- 39. One timeline look: the client step pop-up's stage chips become the vertical stepper (Part 4) ----------
{
  const k = 's/home/v7p_step.dc.html', i = T[k].indexOf('</style>'); if (i < 0) fail(k + ': style');
  T[k] = T[k].slice(0, i) + `
/* round 3: the steps of one item read as a vertical stepper everywhere (owner, 26 Oct) */
[role="list"][aria-label="Step timeline"]{flex-direction:column!important;align-items:stretch!important;gap:0!important}
[role="list"][aria-label="Step timeline"]>div{flex:none!important}
[role="list"][aria-label="Step timeline"]>span[aria-hidden="true"]{flex:none!important;width:2px!important;min-width:0!important;height:14px!important;margin-left:20px!important;border-radius:1px!important}
` + T[k].slice(i); bump(k);
}

// ---------- 40. Phase 4 leaves the staff Overview phase list (registrations are their own page) ----------
for (const d of ['lead', 'mgr', 'admin', 'super']) {
  const k = `s/${d}/Overview.dc.html`; if (!T[k]) continue;
  rep(k, ", ['d', 'Phase 4 · Registration', 0, 23, 'upcoming', '', stepsD]", '');
}
// The prototype's screen list no longer offers the old Phase 4 page.
repAll('routes.js', /("inc-phase-4":\{)/, '$1"hide":true,');
if (!/"inc-phase-4":\{"hide":true/.test(T['routes.js'])) fail('routes: inc-phase-4');

// ---------- 41. Staff client page: record tabs with counts (owner pick from lcc Client 360) ----------
for (const d of ['lead', 'mgr', 'admin', 'super']) {
  const k = `s/${d}/Overview.dc.html`; if (!T[k]) continue;
  const m = T[k].indexOf('<main'); if (m < 0) fail(k + ': main');
  const e = T[k].indexOf('</section>', m) + '</section>'.length;
  T[k] = T[k].slice(0, e) + `
      <nav class="ds-rtabs" aria-label="Client record"><a href="#" aria-current="page">Incorporation <b>7/14</b></a><a href="#" data-pick-item="reg|gst|NT" data-go="lead-registrations">Registrations <b>16</b></a><a href="#" data-go="lead-obligations">Obligations <b>25</b></a><a href="#" data-go="lead-vault">Documents <b>18</b></a><a href="#" data-notes>Notes <b>3</b></a></nav>` + T[k].slice(e);
  bump(k);
}

// ---------- 43. Charts use one stacked bar with a legend, not a donut (refresh document) ----------
for (const k of TODAYS.filter(k => k.startsWith('s/mgr/'))) {
  if (!T[k].includes('data-donut="team-tasks"')) continue;
  rep(k, "const mtDonut = 'width:108px;height:108px;border-radius:99px;flex:none;display:grid;place-items:center;background:' + (mtTot ? 'conic-gradient(' + mtStops.join(',') + ')' : '#eef2f7');",
    "const mtDonut = 'width:100%;height:10px;border-radius:5px;flex:none;overflow:hidden;background:' + (mtTot ? 'linear-gradient(90deg,' + mtStops.join(',') + ')' : '#eef2f7');");
  repAll(k, /(<div style="\{\{mtDonut\}\}; cursor: pointer"[^>]*>)<div style="width: 80px; height: 80px;[^"]*"><div>(<b[^>]*>\{\{mtTot\}\}<\/b>)<span[^>]*>tasks<\/span><\/div><\/div>/, '<div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px">$2<span class="mut" style="font-size: 12px">tasks</span></div>$1');
  repAll(k, /<div style="display: flex; gap: 14px; align-items: center; padding: 2px 16px 0">(\s*<div style="display: flex; align-items: baseline)/, '<div style="display: flex; flex-direction: column; gap: 10px; align-items: stretch; padding: 2px 16px 0">$1');
  if (!T[k].includes('linear-gradient(90deg,\' + mtStops')) fail(k + ': task status bar');
}

// ---------- 44. Sidebars in priority order (owner, 26 Oct: "sort the contents in the side navbar as per the priority") ----------
// Daily work first (today, the work list, the clients), then dated work (compliances, registrations), then
// communication (updates, email), then reference (documents), then reports (analytics, audit) and settings.
{
  const STAFF = {
    lead: "const items = [['today', 'Today'], ['work', 'Work', '9', 'r'], ['clients', 'Clients', '8', 'g']];\n    if (mode !== 'before') items.push(['compliances', 'Compliances', mode === 'after' ? '8' : '4', 'g', true]);\n    items.push(['registrations', 'Registrations'], ['updates', 'Updates', '2', 'r'], ['email', 'Email'], ['docs', 'Docs'], ['analytics', 'Analytics'], ['audit', 'Audit']);",
    mgr: "const items = [['today', 'Today'], ['work', 'Work', '9', 'r'], ['leads', 'Project leads', '3', 'g'], ['clients', 'Clients', '8', 'g']];\n    if (mode !== 'before') items.push(['compliances', 'Compliances', mode === 'after' ? '8' : '4', 'g', true]);\n    items.push(['registrations', 'Registrations'], ['updates', 'Updates', '2', 'r'], ['email', 'Email'], ['docs', 'Docs'], ['analytics', 'Analytics'], ['audit', 'Audit']);",
    admin: "const items = [['today', 'Today'], ['work', 'Work'], ['clients', 'Clients', '14'], ['managers', 'Managers', '3'], ['compliances', 'Compliances'], ['registrations', 'Registrations'], ['updates', 'Updates', '2'],\n      ['email', 'Email'], ['docs', 'Docs'], ['analytics', 'Analytics'], ['audit', 'Audit'], ['settings', 'Firm settings']];",
    super: "const items = [['today', 'Overview'], ['risks', 'Risks', String(A.RISKS.length)], ['clients', 'Clients', '17'], ['practice', 'Practice areas'], ['team', 'Team'],\n      ['growth', 'Growth'], ['reports', 'Reports'], ['settings', 'Firm settings']];"
  };
  for (const [d, neu] of Object.entries(STAFF)) {
    const S = `s/${d}/Side.dc.html`, before = T[S];
    T[S] = d === 'lead' || d === 'mgr'
      ? T[S].replace(/const items = \[[\s\S]*?items\.push\(\['analytics', 'Analytics'\], \['audit', 'Audit'\]\);/, neu)
      : T[S].replace(/const items = \[\[[\s\S]*?\]\];/, neu);
    if (T[S] === before) fail(S + ': sidebar priority order');
    bump(S);
  }
  // Client sidebar: while incorporating, incorporation leads; once incorporated, compliances lead.
  rep('shell.js', '  function active() {', "  function navOrder() {\n    var o = ls('after') === true ? ['home', 'compliances', 'registrations', 'documents', 'updates', 'incorporation', 'credentials', 'knowledge-bank', 'team', 'audit'] : ['home', 'incorporation', 'documents', 'updates', 'registrations', 'compliances', 'credentials', 'knowledge-bank', 'team', 'audit'];\n    return NAV.slice().sort(function (a, b) { return o.indexOf(a.k || a.g) - o.indexOf(b.k || b.g); });\n  }\n  function active() {");
  repAll('shell.js', /NAV\.forEach\(function \(n\) \{/g, 'navOrder().forEach(function (n) {');
}

// ---------- 46. Client Incorporation page: refresh COI card, three phases (owner, 26 Oct: "why is it still like this") ----------
// Registrations left incorporation, so this page counts 25 steps in 3 phases, not 48 in 4. The COI card follows
// the refresh: the countdown or date in white with a quiet label, a soft status chip, no SPICe+ ring and no info
// button, and one phase bar split by phase with its label under each part.
{
  const F = 's/inc/incorporation.html';
  rep(F, "var all=doneN(STEPS),pct=Math.round(all/48*100),h='<section class=\"coi\"", "var INC=STEPS.filter(function(x){return x.p<4;}),all=doneN(INC),pct=Math.round(all/INC.length*100),h='<section class=\"coi\"");
  rep(F, "  h+='<button type=\"button\" class=\"pill\" data-allsteps aria-label=\"'+all+' of 48 steps done · '+pct+'%\"><span>'+all+' / 48 steps</span><span class=\"tr\"><i style=\"width:'+Math.max(pct,2)+'%\"></i></span><b>'+pct+'%</b></button>';",
    "  var cp=AFTER_ON?0:curPhase();\n  h+='<button type=\"button\" class=\"ds-cp\" data-allsteps aria-label=\"'+all+' of '+INC.length+' steps done · '+pct+'%\"><span class=\"ds-cph\"><b>'+all+' / '+INC.length+' steps</b><span>'+pct+'%</span></span><span class=\"ds-phs\">'+[1,2,3].map(function(p){var l=steps(p),dn=doneN(l),w=Math.round(dn/l.length*100);return '<span class=\"'+(p===cp?'cur':'')+'\" style=\"flex:'+l.length+'\"><span class=\"pb\"><i style=\"width:'+(dn?Math.max(w,6):0)+'%;background:'+(dn===l.length?'#46a87a':'#6fa3e0')+'\"></i></span><small>'+PH[p-1]+' · '+dn+'/'+l.length+'</small></span>';}).join('')+'</span></button>';");
  rep(F, "  var d=doneN(STEPS);\n  var h='<section class=\"card acc phc\"", "  var d=doneN(STEPS.filter(function(x){return x.p<4;}));\n  var h='<section class=\"card acc phc\"");
  rep(F, "<span class=\"cnt\">'+d+' of 48 steps · Sep to Dec 2026</span>", "<span class=\"cnt\">'+d+' of 25 steps · Sep to Nov 2026</span>");
  rep(F, "  for(var p=1;p<=4;p++)h+=phaseRow(p);", "  for(var p=1;p<=3;p++)h+=phaseRow(p);");
  rep(F, "'<div class=\"hm\">'+all+'/48 · '", "'<div class=\"hm\">'+doneN(STEPS.filter(function(x){return x.p<4;}))+'/25 · '");
  rep(F, "<div class=\"eb\">Incorporation · 4 phases</div>", "<div class=\"eb\">Incorporation · 3 phases</div>");
  rep(F, "function drillAll(){var tabs=tabsFor(STEPS);drill({title:'All 48 steps',sub:doneN(STEPS)+' done · '+(48-doneN(STEPS))+' to go',", "function drillAll(){var INC=STEPS.filter(function(x){return x.p<4;}),tabs=tabsFor(INC);drill({title:'All '+INC.length+' steps',sub:doneN(INC)+' done · '+(INC.length-doneN(INC))+' to go',");
  T[F] = T[F].replace('</style>', `
.coi{background:linear-gradient(110deg,#1b3049,#15263b 75%)!important;box-shadow:none!important;border:1px solid #15263b;gap:14px!important}
.coi .big span{color:#c9d4e2!important;font-weight:600!important}
.coi .ring,.coi .ibtn{display:none!important}
.coi .chip.done{background:rgba(70,168,122,.18)!important;color:#8fdcb4!important;border:0!important}
.coi .chip.risk{background:rgba(227,160,64,.18)!important;color:#f2c27a!important;border:0!important}
.coi .sub{color:#c9d4e2!important}.coi .sub .mono{color:#9fb2c8!important}.coi .sub a{color:#afc8e8!important}
.ds-cp{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;width:100%;cursor:pointer;border-radius:6px}
.ds-cp:focus-visible{outline:2px solid #afc8e8;outline-offset:4px}
.ds-cph{display:flex;align-items:baseline;gap:10px;font-size:13px;color:#fff}.ds-cph b{font-weight:650}.ds-cph span{color:#9fb2c8}
.ds-phs{display:flex;gap:4px}.ds-phs>span{min-width:0;display:flex;flex-direction:column;gap:6px}
.ds-phs .pb{height:10px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}.ds-phs .pb i{display:block;height:100%;border-radius:5px}
.ds-phs small{font-size:11.5px;color:#8fa3bb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ds-phs .cur small{color:#afc8e8;font-weight:600}
.gax,.phh{grid-template-columns:24px minmax(150px,210px) minmax(0,1fr) 4px!important}
.gbar{height:16px!important;margin-top:-8px}
.gbar.s-done .f{background:#46a87a!important}
.gbar .lt{background:repeating-linear-gradient(45deg,#dd6262 0 4px,#e98c8c 4px 8px)!important;border-radius:0 6px 6px 0}
.gbar.s-active{background:#e6effa!important;box-shadow:inset 0 0 0 1px #b9d0ec!important}
.gbar.s-active .f{background:#2563a8!important}
.gbar .nw{display:none!important}
.gbar.s-up{background:#eceff4!important}
.gbar .ms{width:12px!important;height:12px!important;margin-top:-6px!important;background:#e9792f!important;box-shadow:none!important}
.si.xl{width:22px!important;height:22px!important}.si.xl svg{width:12px!important;height:12px!important}
.si.done{background:#e2f3ea!important;color:#1e7f55!important}
.si.prog,.si.with,.si.you{background:#e6effa!important;color:#2563a8!important;box-shadow:inset 0 0 0 2px #2563a8!important}
.si.up{background:#fff!important;box-shadow:inset 0 0 0 1.5px #d5dbe3!important}
.si.late{background:#fbe6e6!important;color:#be3434!important}
.today{background:#e9792f!important}.today:after{background:#e9792f!important}
.phr{border-top:1px solid #eef0f3}
.gax .tl span:last-child{display:none}
</style>`);
  rep(F, "AX1='2026-12-31'", "AX1='2026-11-30'");
  bump(F);
}

// 24 · Client Compliance status: the donut becomes the total and one stacked bar (refresh "stats strip").
for (const k of Object.keys(T).filter(k => /^s\/home\/v7c_comp/.test(k))) {
  const before = T[k];
  T[k] = T[k].replace(/<div style="padding:22px 16px 16px;display:flex;gap:20px;align-items:center"><div style="position:relative;width:140px;height:140px;flex:none"><div style="width:140px;height:140px;border-radius:99px;background:conic-gradient\(([^)]*(?:\([^)]*\)[^)]*)*)\);display:flex;align-items:center;justify-content:center"><a href="#" title="Show all" style="[^"]*"><span class="metric" style="[^"]*">(\d+)<\/span><span class="cap" style="">([^<]*)<\/span><\/a><\/div><\/div><div style="flex:1">/,
    (m, stops, n, cap) => `<div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px"><a href="#" title="Show all" style="display:flex;align-items:baseline;gap:8px;color:var(--fg);text-decoration:none"><span class="metric" style="font-size:24px;line-height:1;color:var(--fg)">${n}</span><span class="cap" style="">${cap}</span></a><div aria-hidden="true" style="height:10px;border-radius:5px;overflow:hidden;background:linear-gradient(90deg,${stops})"></div><div style="flex:1">`);
  if (T[k] === before) fail(k + ': compliance status bar'); bump(k);
}
// Staff client list: three phases and 25 steps (registrations have their own page).
for (const k of ['s/lead/Clients.dc.html', 's/mgr/Clients.dc.html']) {
  rep(k, "r.steps = sum + '/48';", "r.steps = (done[0] + done[1] + done[2]) + '/25';");
  rep(k, '<span style="flex: 23">P4 REGISTRATION</span>', '');
  rep(k, '<span style="{{r.s3}}" title="{{r.t3}}"></span>', '');
}
// 12 · Dark mode is slate, not true black (refresh: calm canvas in both themes).
rep('proto.js', "'--bg:#000;--panel:oklch(13% 0.006 260);--raised:oklch(17% 0.008 260);--border:oklch(24% 0.01 260);--hair:oklch(19% 0.008 260);'", "'--bg:#111821;--panel:#18202b;--raised:#1f2935;--border:#2c3745;--hair:#232d3a;'");
// Phase progress legend matches the bars (no dashed cells any more).
for (const k of Object.keys(T).filter(k => /^s\/(lead|mgr|admin)\/.*\.dc\.html$/.test(k))) repAll(k, /Next dashed/g, 'Next grey');

// ---------- 9. Back means the previous screen: inside the landing's portal layer, defer to browser history ----------
rep('proto.js', '  function goBack() {\n    var h = histGet()', "  function goBack() {\n    try { if (window.parent !== window && window.parent.__vcfoAppBack) { window.parent.__vcfoAppBack(); return; } } catch (e) {}\n    var h = histGet()");

// proto.js: the lead sign-out button, and the design-system layer appended to every screen.
// ---------- 42. Portal refresh palette (owner, 26 Oct: "follow the UI rules from the revise UI document") ----------
// claude.ai/artifact/RhNoYnFXSJgV1TU4fFrFws: a calm canvas, primary blue #2563A8, brand orange #E9792F only for small
// highlights, sidebar navy #15263B, ink #16212F, statuses green #1E7F55, amber #A35F00, red #BE3434, each with a soft tint.
const REFRESH = {
  '#0f2a4a': '#15263b', '#13294b': '#15263b', '#17396b': '#1b3049', '#1d3d64': '#2b4766',
  '#1b4f94': '#2563a8', '#1a5fb4': '#2563a8', '#163f78': '#1e5290', '#e8f0fa': '#e6effa', '#e5f4ff': '#e6effa', '#6aa2e8': '#6fa3e0',
  '#0f6e51': '#1e7f55', '#e1f3ec': '#e2f3ea',
  '#be4400': '#a35f00', '#e4731b': '#a35f00', '#ffeedc': '#fcefd8', '#9b3b08': '#a35f00', '#8a6514': '#a35f00', '#f5d3b8': '#f1d9ae',
  '#b5302a': '#be3434', '#fdeceb': '#fbe6e6', '#f9dcda': '#f6d2d2',
  '#656f7e': '#56627a', '#e6eaf0': '#eceff4', '#dfe5ee': '#e3e6eb',
  '#4b5b70': '#667180', '#4a5a73': '#667180', '#7b8a9e': '#98a1ae', '#8593a6': '#98a1ae', '#a8b4c4': '#b4bcc7',
  '#e1e7ef': '#e3e6eb', '#d5dce6': '#dfe3e9', '#c9d3df': '#d5dbe3', '#eef2f7': '#eef0f3', '#f3f5f9': '#f5f6f8', '#f4f6f9': '#f5f6f8',
  '#c9a24b': '#e9792f', '#e6c46e': '#f2a65e', '#6e96ff': '#e9792f', '#24364d': '#3f4a59'
};
const refreshRe = new RegExp('(' + Object.keys(REFRESH).join('|') + ')(?![0-9a-fA-F])', 'gi');
const refresh = (t) => t.replace(refreshRe, (m) => REFRESH[m.toLowerCase()]);
const DS = readFileSync(join(here, 'ds.css'), 'utf8').replace(/\r\n/g, '\n');
// ---------- 45. Every card in the refresh's shape (owner, 26 Oct: "follow the rules for each and every card") ----------
// Card heads get a 28px tinted icon tile picked from the title; greeting numbers get a 30px tinted icon;
// segmented controls are small inline buttons with the picked one in navy. The icons are drawn here and
// carried in the design layer's stylesheet; the layer marks each head and number with data-ds-ic / data-ds-kic.
const TONES = { blue: ['#e6effa', '#2563a8'], teal: ['#e0f3f4', '#0f7c86'], amber: ['#fcefd8', '#a35f00'], green: ['#e2f3ea', '#1e7f55'], violet: ['#efeafb', '#6a4fb6'], red: ['#fbe6e6', '#be3434'] };
const GLYPH = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  clip: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="m9 13 2 2 4-4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-7A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  alert: '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3"/><path d="M20 4v14h-5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>'
};
const svgUrl = (g, c) => 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPH[g]}</svg>`) + '")';
// Head icons: one tone per icon, so a card means the same thing on every screen.
const HEAD = { calendar: 'teal', bell: 'amber', list: 'blue', file: 'amber', clip: 'teal', shield: 'green', id: 'violet', clock: 'violet', inbox: 'blue', user: 'violet', chart: 'blue', check: 'green', alert: 'red', grid: 'blue', mail: 'blue', book: 'teal', key: 'violet', pulse: 'green', flag: 'green', building: 'blue' };
// Number icons: [glyph, tone] per meaning.
const KPI = { waiting: ['user', 'amber'], overdue: ['alert', 'red'], soon: ['calendar', 'amber'], reg: ['id', 'violet'], coi: ['flag', 'green'], action: ['list', 'blue'], done: ['check', 'green'], sbc: ['building', 'blue'],
  clients: ['user', 'blue'], inc: ['building', 'blue'], comp: ['shield', 'green'], people: ['user', 'violet'], svc: ['pulse', 'green'], conn: ['grid', 'amber'], msg: ['mail', 'red'], job: ['alert', 'red'], secret: ['key', 'red'], ver: ['flag', 'blue'], docs: ['file', 'teal'], week: ['calendar', 'teal'] };
let DSX = '\n/* 45 · card heads and greeting numbers: tinted icon tiles (generated in patch.mjs) */\n' +
  '[data-ds-ic]{line-height:28px}\n' +
  '[data-ds-ic]::before{content:"";display:inline-block;vertical-align:middle;margin:-3px 10px 0 0;width:28px;height:28px;border-radius:8px;background:var(--hic-bg) var(--hic-img) center/15px no-repeat}\n' +
  '[data-ds-ic="-"]::before{display:none}\n' +
  '[data-ds-kic]{display:grid!important;grid-template-columns:30px auto;grid-template-rows:auto auto;column-gap:10px!important;row-gap:1px!important;align-items:center;justify-content:start}\n' +
  '[data-ds-kic]::before{content:"";grid-row:1 / span 2;grid-column:1;width:30px;height:30px;border-radius:8px;background:var(--kic-bg) var(--kic-img) center/16px no-repeat}\n' +
  '[data-ds-kic] > :first-child{grid-row:2;grid-column:2}\n[data-ds-kic] > :last-child{grid-row:1;grid-column:2}\n';
for (const [g, t] of Object.entries(HEAD)) DSX += `[data-ds-ic="${g}"]{--hic-bg:${TONES[t][0]};--hic-img:${svgUrl(g, TONES[t][1])}}\n.tile[data-ds-tone="${g}"]{background:${TONES[t][0]}!important;color:${TONES[t][1]}!important;border-color:transparent!important}\n`;
for (const [k, [g, t]] of Object.entries(KPI)) DSX += `[data-ds-kic="${k}"]{--kic-bg:${TONES[t][0]};--kic-img:${svgUrl(g, TONES[t][1])}}\n`;
const DSR = refresh(DS) + DSX;
T['proto.js'] += String.raw`
/* design-system v1.2 layer and the lead sign-out (added by proto-fix/patch.mjs) */
(function () {
  var css = ${JSON.stringify(DSR)};
  function add() { var s = document.getElementById('ds-layer'); if (!s) { s = document.createElement('style'); s.id = 'ds-layer'; s.textContent = css; } (document.head || document.documentElement).appendChild(s); }
  add(); document.addEventListener('DOMContentLoaded', add); window.addEventListener('load', add);
  // Mono is for identifiers only (CIN, PAN, DIN, GSTIN, SRN, step codes, file names). Anything else
  // set in mono by a screen (dates, times, counts, labels) is switched to Public Sans with tabular figures.
  var ID = /^(?:[A-Z]{1,4}\d[A-Z0-9]{4,}|[A-Z]{5}\d{4}[A-Z]|U\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}|(?:Pre|Post|Reg|Step)[- ]?\d+|SRN\b.*|[A-Z]{2,5}-\d+[A-Z]?|.+\.(?:pdf|docx?|xlsx?|zip|png|jpe?g))$/;
  // Navy-filled controls on the lead and manager screens: an action becomes the brand primary, the picked
  // option of a group becomes brand-soft, a count pill becomes the brand count. The sidebar and the
  // greeting card keep their navy.
  var NAVY = 'rgb(21, 38, 59)';
  if (/(^|\/)s\/(lead|mgr|admin|super|dev)\//.test(String(window.__VPATH || ''))) document.documentElement.classList.add('ds-staff');
  function buttons() {
    if (!isLead) return;
    var dk = document.querySelectorAll('.btn:not(.btnp)');
    for (var j = 0; j < dk.length; j++) { if (getComputedStyle(dk[j]).color === 'rgb(255, 255, 255)') dk[j].setAttribute('data-ds-ondark', ''); else dk[j].removeAttribute('data-ds-ondark'); }
    var els = document.querySelectorAll('button, a.btn, [role="button"], .chip, .fc');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest('aside, #vp-bar, #vp-toast, [data-vp="side"]')) continue;
      el.removeAttribute('data-ds-primary'); el.removeAttribute('data-ds-on'); el.removeAttribute('data-ds-count');
      if (getComputedStyle(el).backgroundColor !== NAVY) continue;
      var tag = el.tagName, p = el.parentElement;
      if (tag !== 'BUTTON' && !el.matches('a.btn, [role="button"], .fc')) {
        if (el.matches('.chip') && (el.textContent || '').trim().length < 40) el.setAttribute('data-ds-count', '');
        continue;
      }
      var group = el.hasAttribute('aria-pressed') || el.matches('.fc') || (p && (p.matches('.seg, [role="group"], [role="tablist"]') || p.querySelectorAll(':scope > button').length > 1 && !el.matches('.btnp')));
      el.setAttribute(group ? 'data-ds-on' : 'data-ds-primary', '');
    }
  }
  // Portal refresh: status is a quiet chip on every screen. Anything painted as a solid block with white text
  // (chips, date tiles, grid cells, heatmap counts) becomes a soft tint with text of the same hue. Real buttons,
  // the sidebar and the one navy focus block per screen stay as they are.
  var BGRE = /background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|var\(--[a-z-]+\))/;
  var SOFTSEL = '.chip, .pill, td .sol, .stw, .ds-soft, .dn .dt, .dtile, [style*="color:#fff"], [style*="color: #fff"], [style*="color:#FFF"], [style*="color: rgb(255, 255, 255)"]';
  var KEEP = '[data-ds-keep], aside, .vps, #vp-bar, #vp-toast, #ds-island, #vp-chat, #vp-launch, .vp-pop, [data-card="greeting"], .hero, .summary, .it-band, .ds-dlg, header, nav, .vh-top, [role="dialog"]';
  function words() {
    var els = document.querySelectorAll(SOFTSEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.classList.contains('stw') || el.classList.contains('ds-soft')) {
        if (!el.style.getPropertyValue('--c')) { var m0 = BGRE.exec(el.getAttribute('style') || ''); if (m0) el.style.setProperty('--c', m0[1]); }
        continue;
      }
      if (el.closest(KEEP)) continue;
      var tag = el.tagName;
      if ((tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') && !el.closest('.ds-row, .wk, td')) continue;
      if (el.matches('.btn, .btnp, .it-btn, .ap-b, [data-ds-primary], [data-ds-on], [data-ds-count], .rg-strip button')) continue;
      var cs = getComputedStyle(el); if (cs.color !== 'rgb(255, 255, 255)') continue;
      var bgc = cs.backgroundColor, m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(bgc);
      if (m) { if (m[4] !== undefined && +m[4] < .6) continue; var lum = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255; if (lum < .06 || lum > .92) continue; }
      else { var ok = /oklch\(([\d.]+)%?\s+[\d.]+\s+[\d.]+(?:\s*\/\s*([\d.]+%?))?\)/.exec(bgc); if (!ok) continue; var L = +ok[1] > 1 ? +ok[1] / 100 : +ok[1]; if (L < .3 || L > .95) continue; if (ok[2] && parseFloat(ok[2]) < (ok[2].indexOf('%') > 0 ? 60 : .6)) continue; }
      el.style.setProperty('--c', cs.backgroundColor);
      el.classList.add(el.matches('.chip, .pill, td .sol, td > span, td > b') && !el.matches('.cg td > span, .fg td > span') ? 'stw' : 'ds-soft');
    }
  }
  // Table heads are sentence case (owner, 26 Oct). Heads typed in capitals are rewritten once, keeping
  // acronyms (GSTR-1, TDS, COI) and single letters (Part A) as they are.
  var ACR = /^(COI|TDS|TCS|PF|ECR|ESI|PT|GST|GSTR|GSTIN|DIR|ADT|FC|GPR|MCA|ROC|SRN|ARN|DIN|PAN|TAN|KYC|DSC|LLP|FEMA|RBI|CIN|IEC|LUT|MSME|AGM|AOC|MGT|SPICE|NIC|UAN|IP|ID|FY|AY|OTP|SLA)$/;
  var MD = /^(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)$/;
  var PN = /^(northwind|pranay|bharath|rohan|kumar|mei|tanaka|karnataka|india|bengaluru|krishna|mithilesh|farhath|sneha|meera|priya|arjun)$/;
  function sentence(t) {
    var first = true;
    return t.replace(/[A-Za-z0-9’'+.-]+/g, function (w) {
      var core = w.replace(/[’'].*$/, ''), lw = w.toLowerCase(), lc = core.toLowerCase(), out;
      if (/\d/.test(w) || ACR.test(core.toUpperCase().replace(/[^A-Z]/g, '')) || core.length === 1 || /^(AM|PM|IST|SPICE\+)$/.test(core.toUpperCase())) out = w;
      else if (MD.test(lc) || PN.test(lc)) out = lw.charAt(0).toUpperCase() + lw.slice(1);
      else out = first ? lw.charAt(0).toUpperCase() + lw.slice(1) : lw;
      first = false; return out;
    });
  }
  function heads() {
    var els = document.querySelectorAll('thead th, .ds-head > span, .ds-head > span > span, .mr .h, .rk.h > span, .mono, .when, .eyebrow, .lbl, .cap, .kicker, [data-ds-sans], [data-card="greeting"] div, .vh-crumb li, h2, h3, b, small, span, div');
    for (var i = 0; i < els.length; i++) {
      var el = els[i]; if (el.children.length || el.closest('#vp-bar, svg, code, kbd, .vps-logo, .cs')) continue;
      var t = el.textContent; if (t.length > 70 || t !== t.toUpperCase() || !/[A-Z]{3}/.test(t) || (!/\s/.test(t.trim()) && !el.matches('thead th, .ds-head span, .mr .h, .rk.h > span, .lbl, .cap, .eyebrow'))) continue;
      var n = sentence(t); if (n !== t) el.textContent = n;
    }
  }
  // Card heads: a tinted icon tile picked from the title (refresh "card-h .hic"). A head that already has an
  // icon tile keeps it, recoloured by the same rule. Greeting numbers get the same treatment.
  var HIC = [[/risk|stuck|overdue|incident|escalat|broken/i, 'alert'], [/alert|update|notification|announcement/i, 'bell'], [/approv|decision|granted/i, 'check'],
    [/timeline|week|calendar|what is next|coming|deadline|schedule|renewal|plan/i, 'calendar'], [/inbox|triage|message/i, 'inbox'],
    [/need|document|docs\b|vault|upload|file/i, 'file'], [/compliance|filing|obligation|statute|status/i, 'shield'], [/sbc is doing|holds|pending with|progress flow/i, 'clip'],
    [/waiting|client|people|lead|manager|team|who/i, 'user'], [/registration|\bids\b|identit|credential/i, 'id'], [/activity|audit|recent|history|log/i, 'clock'],
    [/step|queue|work|task|action|post-incorporation/i, 'list'], [/phase|practice|analytics|growth|report|chart|health|area|service/i, 'chart'], [/email|mail/i, 'mail'], [/library|knowledge|sop|book/i, 'book']];
  var KIC = [[/waiting/i, 'waiting'], [/overdue|late|failed|failing/i, 'overdue'], [/due soon|this week|due in/i, 'soon'], [/registration/i, 'reg'], [/incorporated|coi/i, 'coi'], [/action|open|needs/i, 'action'],
    [/done|filed|on time/i, 'done'], [/with sbc/i, 'sbc'], [/incorporat/i, 'inc'], [/complian/i, 'comp'], [/client/i, 'clients'], [/manager|lead|staff|people|team/i, 'people'], [/service/i, 'svc'],
    [/connection/i, 'conn'], [/message/i, 'msg'], [/job/i, 'job'], [/secret/i, 'secret'], [/version/i, 'ver'], [/document/i, 'docs'], [/week/i, 'week']];
  function pick(list, t) { for (var i = 0; i < list.length; i++) if (list[i][0].test(t)) return list[i][1]; return null; }
  var CARDSEL = 'section.card, .pa-c, section.ap, section.mt, section.rg-card, .cp .card';
  function cards() {
    var cs = document.querySelectorAll(CARDSEL);
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i]; if (c.closest('.cs, [role="dialog"], aside, .vh-greet, [data-card="greeting"], .hero')) continue;
      var h = c.querySelector(':scope > div:first-of-type > h3, :scope > div:first-of-type > h2, :scope > .ch h2, :scope > .ch h3, :scope > .pa-h h2, :scope > h2, :scope > header h2, :scope > div:first-of-type > div > h2');
      if (!h || h.hasAttribute('data-ds-ic')) continue;
      var r = h.getBoundingClientRect(), cr = c.getBoundingClientRect(); if (r.top - cr.top > 64) continue;
      var key = pick(HIC, h.textContent || '') || 'grid';
      var row = h.parentElement, tile = row && row.querySelector(':scope > .tile, :scope > .pa-ic, :scope > span > svg');
      if (tile && tile.compareDocumentPosition(h) & 4) { var t = tile.matches('svg') ? tile.parentElement : tile; if (t.classList.contains('tile')) t.setAttribute('data-ds-tone', key); h.setAttribute('data-ds-ic', '-'); continue; }
      h.setAttribute('data-ds-ic', key);
    }
    // Main buttons are navy (refresh "btn primary"): any solid blue button with white text.
    var bl = document.querySelectorAll('button, a.btn, a[class*="btn"], [role="button"]');
    for (var u = 0; u < bl.length; u++) {
      var be = bl[u]; if (be.hasAttribute('data-ds-blue') || be.closest('aside, .vps, #vp-bar, .cs-rail, [data-ds-keep]')) continue;
      var bcs = getComputedStyle(be); if (bcs.color !== 'rgb(255, 255, 255)') continue;
      if (/^rgb\((37, 99, 168|47, 111, 208|30, 82, 144|27, 79, 148)\)$/.test(bcs.backgroundColor)) be.setAttribute('data-ds-blue', '');
    }
    // Owner chips (who holds it): one width, a dot, the owner's soft colour.
    var oc = document.querySelectorAll('.chip:not([data-ds-own]), .own:not([data-ds-own])');
    for (var v = 0; v < oc.length; v++) { var ot = (oc[v].textContent || '').trim(); if (/^(Northwind|SBC|MCA|Client|You|Bharath|Pranay)$/.test(ot)) oc[v].setAttribute('data-ds-own', /^(Northwind|Client|You)$/.test(ot) ? 'client' : ot === 'MCA' ? 'mca' : 'firm'); }
    // Phase progress: each phase cell becomes a 6px bar with its count under it.
    var pcs = document.querySelectorAll('section.card');
    for (var w = 0; w < pcs.length; w++) {
      var hh = pcs[w].querySelector('h2, h3'); if (!hh || !/^Phase progress/.test((hh.textContent || '').trim())) continue;
      var cells = pcs[w].querySelectorAll('.ds-row > span:nth-child(2) > span:not(.ds-pcell)');
      for (var x2 = 0; x2 < cells.length; x2++) {
        var ce = cells[x2], tx = (ce.textContent || '').trim(), mm = /(\d+)\s*\/\s*(\d+)/.exec(tx), pv = tx === '✓' ? 100 : mm ? Math.round(+mm[1] / Math.max(1, +mm[2]) * 100) : 0;
        var cc = getComputedStyle(ce).backgroundColor, dashed = /dashed/.test(ce.getAttribute('style') || '');
        ce.classList.add('ds-pcell'); ce.style.setProperty('--p', (pv && pv < 6 ? 6 : pv) + '%');
        ce.style.setProperty('--pc', tx === '✓' ? '#46a87a' : dashed ? '#d5dbe3' : (/190, 52, 52/.test(cc) || /be3434/i.test(ce.style.getPropertyValue('--c'))) ? '#dd6262' : '#2563a8');
        if (tx === '✓') ce.setAttribute('data-done', '');
      }
    }
    // Client timeline: once the card says Completed, the COI row is ticked too.
    var tls = document.querySelectorAll('.vh-tl');
    for (var z = 0; z < tls.length; z++) {
      var card = tls[z].closest('section.card'); if (!card || !/Completed/.test((card.querySelector(':scope > div') || {}).textContent || '')) continue;
      var coi = tls[z].querySelector('.tipw[aria-label="COI"]'); if (coi) { var rw = coi.closest('div[style*="grid-template-columns"]'); if (rw && !rw.hasAttribute('data-ds-done')) rw.setAttribute('data-ds-done', ''); }
    }
    var sg = document.querySelectorAll('section.card > div:first-of-type .seg:not(.ds-tight)');
    for (var q = 0; q < sg.length; q++) { var hd = sg[q].closest('section.card > div'), h3 = hd && hd.querySelector(':scope > h3'); if (hd && (hd.scrollWidth > hd.clientWidth + 1 || (h3 && h3.scrollWidth > h3.clientWidth + 1))) sg[q].classList.add('ds-tight'); }
    var ph = document.querySelectorAll('details.stp-g > summary:not([data-ds-p])');
    for (var p = 0; p < ph.length; p++) {
      var ch = ph[p].querySelector('.chip'), m = ch && /(\d+)\s*(?:of|\/)\s*(\d+)/.exec(ch.textContent || ''); if (!m) continue;
      var pc = Math.round(+m[1] / Math.max(1, +m[2]) * 100); ph[p].setAttribute('data-ds-p', pc);
      ph[p].style.setProperty('--ds-p', pc + '%'); ph[p].style.setProperty('--ds-pc', pc >= 100 ? '#46a87a' : '#2563a8');
    }
    var ks = document.querySelectorAll('.vh-greet .vh-stat, html.ds-staff .gk > a, html.ds-staff .hero .kp > span');
    for (var j = 0; j < ks.length; j++) {
      var k = ks[j]; if (k.hasAttribute('data-ds-kic')) continue;
      var lab = (k.lastElementChild || k).textContent || '';
      k.setAttribute('data-ds-kic', pick(KIC, lab) || 'action');
    }
  }
  function sweep() {
    buttons(); words(); heads(); cards();
    var els = document.querySelectorAll('.mono,[style*="Plex Mono"],[style*="monospace"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i]; if (el.closest('#vp-bar,#vp-toast,#vp-tip')) continue;
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && !ID.test(t)) el.setAttribute('data-ds-sans', ''); else el.removeAttribute('data-ds-sans');
    }
  }
  // Breadcrumbs navigate: every segment except the current page becomes a link to its route.
  var isLead = /(^|\/)s\/(lead|mgr|admin|super|dev)\//.test(String(window.__VPATH || ''));
  var pre = /(^|\/)s\/dev\//.test(String(window.__VPATH || '')) ? 'dev-' : /(^|\/)s\/super\//.test(String(window.__VPATH || '')) ? 'super-' : /(^|\/)s\/admin\//.test(String(window.__VPATH || '')) ? 'admin-' : (/(^|\/)s\/mgr\//.test(String(window.__VPATH || '')) ? 'mgr-' : 'lead-');
  var CR = [['today', 'home'], ['home', 'home'], ['overview', 'home'], ['work', 'work'], ['clients', 'clients'], ['docs', 'vault'], ['vault', 'vault'], ['knowledge bank', 'knowledge-bank'], ['library', 'knowledge-bank'], ['updates', 'announcements'], ['announcements', 'announcements'], ['notifications', 'notifications'], ['compliances', 'compliances'], ['calendar', 'compliances'], ['filings', 'filings'], ['analytics', 'analytics'], ['audit', 'audit'], ['settings', 'settings'], ['email', 'email'], ['incorporation', 'incorporation'], ['documents', 'documents'], ['team', 'team'], ['credentials', 'credentials'], ['board resolution', 'board-resolution'], ['my work', 'work'], ['my leads', 'leads'], ['project leads', 'leads'], ['managers', 'managers'], ['registrations', 'registrations'], ['obligations', 'obligations']];
  function crumbRoute(t) {
    t = t.toLowerCase().replace(/\s+/g, ' ').trim();
    var R = window.__VCFO_ROUTES || {}, r = null;
    for (var i = 0; i < CR.length; i++) if (t === CR[i][0]) { r = CR[i][1]; break; }
    if (!r && /^phase \d/.test(t)) r = 'inc-phase';
    if (!r && /pvt ltd|technologies|foods|analytics|robotics|logistics|health|fintech|bio\b/.test(t)) r = isLead ? 'overview' : 'incorporation';
    if (!r) return null;
    if (isLead) { if (r === 'home') return pre + 'home'; return R[pre + r] ? pre + r : (R['lead-' + r] ? 'lead-' + r : null); }
    return R[r] ? r : null;
  }
  function crumbs() {
    var navs = document.querySelectorAll('nav[aria-label="Location"], nav[aria-label="Breadcrumb"], nav.vh-crumb, nav.crumb, nav.cr-trail');
    for (var n = 0; n < navs.length; n++) {
      var nav = navs[n], list = nav.querySelector('ol, ul'), kids = [].slice.call((list || nav).children);
      var segs = kids.filter(function (el) { var t = (el.textContent || '').replace(/\s+/g, ' ').trim(); return t && !/^[\/›>·|]$/.test(t); });
      for (var i = 0; i < segs.length - 1; i++) {
        var el = segs[i]; if (el.hasAttribute('data-crumb-go') || el.matches('a[data-go]')) continue;
        var route = crumbRoute(el.textContent || ''); if (!route) continue;
        el.setAttribute('data-crumb-go', route); el.setAttribute('role', 'link'); el.setAttribute('tabindex', '0'); el.classList.add('ds-crumb');
      }
    }
  }
  // Live status pill: vcfoStatus(['Filing GSTR-3B · Kestrel · 1 of 4', ...], 'Filed · ARN AA2910…').
  window.vcfoStatus = function (steps, doneText) {
    var el = document.getElementById('ds-island');
    if (!el) { el = document.createElement('div'); el.id = 'ds-island'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    var i = 0; clearTimeout(el._t);
    function step() {
      if (i < steps.length) { el.innerHTML = '<span class="sp" aria-hidden="true"></span><span></span>'; el.lastChild.textContent = steps[i++]; el.classList.add('on'); el._t = setTimeout(step, 800); return; }
      el.innerHTML = '<span class="ok" aria-hidden="true"></span><span></span>'; el.lastChild.textContent = doneText; el._t = setTimeout(function () { el.classList.remove('on'); }, 2200);
    }
    step();
  };
  // Rolling numbers in the greeting strip: they count up once when the page opens.
  function roll() {
    if (!isLead || roll.done) return; var els = document.querySelectorAll('.gk b, .hero .kp b'); if (!els.length) return; roll.done = true;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    [].forEach.call(els, function (el) {
      var host = el.querySelector('.sc-interp') || el, node = host.firstChild; if (!node || node.nodeType !== 3) return;
      var t = node.nodeValue, m = /^(\D*)(\d[\d,]*)(.*)$/.exec(t.trim()); if (!m) return;
      var to = +m[2].replace(/,/g, ''), k = 0; if (!to || to > 100000) return;
      var iv = setInterval(function () { k++; if (node.nodeValue !== t && k > 1 && !node.parentNode) { clearInterval(iv); return; } node.nodeValue = m[1] + Math.round(to * k / 14).toLocaleString('en-IN') + m[3]; if (k >= 14) { clearInterval(iv); node.nodeValue = t; } }, 32);
    });
  }
  window.addEventListener('load', function () { setTimeout(roll, 700); });
  window.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-notes]'); if (!t) return; e.preventDefault(); e.stopPropagation();
    if (window.vcfoToast) window.vcfoToast('Notes · staff only: Rohan prefers calls after 4 pm · Mei handles payroll data');
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-vault-client')) return;
    if (window.vcfoToast) window.vcfoToast('Showing ' + t.value + ' · this prototype keeps Northwind\'s files');
  }, true);
  window.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-pick-item]'); if (!t) return;
    try { sessionStorage.setItem('vcfo.item', t.getAttribute('data-pick-item')); } catch (x) {}
  }, true);
  window.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-inbox-tab]'); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    var sec = t.closest('[data-inbox]'); if (!sec) return;
    sec.setAttribute('data-inbox', t.getAttribute('data-inbox-tab'));
    [].forEach.call(sec.querySelectorAll('[data-inbox-tab]'), function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
  }, true);
  window.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-pick-mgr]'); if (!b) return;
    try { sessionStorage.setItem('vcfo.mgr', b.getAttribute('data-pick-mgr')); } catch (x) {}
    if (/(^|\/)s\/admin\/Managers\./.test(String(window.__VPATH || ''))) { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('vcfo:mgr')); }
  }, true);
  window.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('[data-nav-fold]'); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    var key = 'vcfo.nav.' + f.getAttribute('data-nav-fold');
    try { sessionStorage.setItem(key, f.getAttribute('aria-expanded') === 'true' ? '0' : '1'); } catch (x) {}
    window.dispatchEvent(new CustomEvent('vcfo:nav'));
  }, true);
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var sc = document.querySelector('.ds-scrim'); if (!sc) return;
    e.preventDefault(); e.stopPropagation(); sc.click();
    var b = document.querySelector('.ds-dd[aria-expanded="true"]'); if (b) b.focus();
  }, true);
  window.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('aside a[aria-label]'); if (!a) return;
    var m = /^(Bharath|Sneha|Meera) /.exec(a.getAttribute('aria-label') || ''); if (!m) return;
    if (!/(^|\/)s\/mgr\/Leads\./.test(String(window.__VPATH || ''))) return;
    e.preventDefault(); e.stopPropagation();
    try { sessionStorage.setItem('vcfo.lead', m[1]); } catch (x) {}
    window.dispatchEvent(new CustomEvent('vcfo:lead', { detail: m[1] }));
  }, true);
  // Incorporation timeline: the phase name opens the phase (the per-row Open button is gone).
  document.addEventListener('click', function (e) {
    var n = e.target.closest && e.target.closest('.phh .pnm'); if (!n) return;
    var o = n.closest('.phh').querySelector('.ob'); if (o) { e.preventDefault(); o.click(); }
  }, true);
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('[data-crumb-go]'); if (!c) return;
    e.preventDefault(); e.stopPropagation(); if (window.vcfoGo) window.vcfoGo(c.getAttribute('data-crumb-go'));
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.hasAttribute || !e.target.hasAttribute('data-crumb-go')) return;
    e.preventDefault(); if (window.vcfoGo) window.vcfoGo(e.target.getAttribute('data-crumb-go'));
  }, true);
  var pend = 0; function later() { if (pend) return; pend = setTimeout(function () { pend = 0; sweep(); crumbs(); }, 60); }
  document.addEventListener('DOMContentLoaded', crumbs); window.addEventListener('load', crumbs);
  document.addEventListener('DOMContentLoaded', sweep); window.addEventListener('load', sweep);
  try { new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] }); } catch (e) {}
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-signout]');
    if (!b || b.closest('.vps')) return;
    e.preventDefault(); e.stopPropagation();
    if (window.vcfoToast) window.vcfoToast('Signed out · this is a prototype, so you stay on the page');
  }, true);
})();
`;

// One orange "today" line on every timeline (refresh: brand orange only for small highlights).
for (const k of Object.keys(T).filter(k => /^s\/home\/v7[cp]_timeline/.test(k))) {
  repAll(k, /width:2px;background:var\(--over\)"/g, 'width:2px;background:#e9792f"');
  repAll(k, /<span class="chip" style="(position:absolute;[^"]*?)background:var\(--over-chip\);color:#fff;([^"]*)">Today/g, '<span class="chip" data-ds-keep style="$1background:#e9792f;color:#fff;$2">Today');
}
// Ctrl K, not ⌘ K: most CA offices run Windows (refresh document).
for (const k of Object.keys(T)) { if (!/\.(html|js)$/.test(k) || !T[k].includes('⌘')) continue; const n = T[k].replace(/<span class="kbd">⌘<\/span><span class="kbd">K<\/span>/g, '<span class="kbd">Ctrl K</span>').replace(/⌘ ?K/g, 'Ctrl K').replace(/>⌘</g, '>Ctrl<'); if (n !== T[k]) { T[k] = n; bump(k); } }
// No decorative colour lines (owner, 26 Oct: "I don't like the border line colours"): the gold fade under
// greeting cards, page heads and the library reader goes on every screen and stylesheet.
{
  const GOLD = /height:\s?3px;\s?background:\s?linear-gradient\(90deg,\s?var\(--gold\)(?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g;
  let hit = 0;
  for (const k of Object.keys(T)) { if (!/\.(html|js|css)$/.test(k)) continue; const n = T[k].replace(GOLD, 'height:0;background:none'); if (n !== T[k]) { T[k] = n; bump(k); hit++; } }
  if (hit < 6) fail('gold lines: only ' + hit + ' files');
}
// Apply the refresh palette to every screen, component, script and stylesheet in the payload.
for (const k of Object.keys(T)) { if (!/\.(html|js|css)$/.test(k)) continue; const n = refresh(T[k]); if (n !== T[k]) { T[k] = n; bump(k); } }

// ---------- write the fixed copy ----------
// The runtime gets Public Sans: the variable face rides in the payload and joins the font CSS.
D.bin['fontsx/public-sans-var.woff2'] = readFileSync(join(here, '..', 'fonts', 'public-sans-var.woff2')).toString('base64');
D.mime['fontsx/public-sans-var.woff2'] = 'font/woff2';
let rest = html.slice(b);
const fontAnchor = /\}\)\.join\(''\);(\r?\n)\s*var api = \{/;
if (!fontAnchor.test(rest)) fail('runtime font anchor');
rest = rest.replace(fontAnchor, (m, nl) => `}).join('') + "@font-face{font-family:'Public Sans';font-style:normal;font-weight:400 700;font-display:swap;src:url(" + bu('fontsx/public-sans-var.woff2') + ") format('woff2')}";${nl}  var api = {`);
{ const o = "{ lead: '#/lead-home', mgr: '#/mgr-home' }"; if (!rest.includes(o)) fail('runtime role hash'); rest = rest.replace(o, "{ lead: '#/lead-home', mgr: '#/mgr-home', admin: '#/admin-home', super: '#/super-home', dev: '#/dev-home' }"); }
rest = rest.replace(/<title>[^<]*<\/title>/, '<title>VCFO Suite · Client, Lead, Manager, Admin, Super admin and Developer portals · Prototype v10</title>');
let head = html.slice(0, a).replace(/<title>[^<]*<\/title>/, '<title>VCFO Suite · Client, Lead, Manager, Admin, Super admin and Developer portals · Prototype v10</title>');
const json = JSON.stringify(D).replace(/</g, '\\u003c');
writeFileSync(OUT, head + pfOpen + json + rest);
const touched = Object.keys(counts).length;
console.log(`Wrote ${OUT} (${(head.length + json.length + rest.length) / 1048576 | 0} MB); ${touched} files changed`);
