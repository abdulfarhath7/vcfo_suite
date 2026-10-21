// Builds the Incorporation screens of the v7 prototype from template.html + app.js:
//   s/inc/incorporation.html (landing), s/inc/phase.html (#p=1..4), s/inc/step.html (#n=1..48), s/inc/board.html (board resolution)
// and patches ONLY the incorporation keys of routes.js (every other key and the __VCFO_FILES line are kept).
// Run (from src/): node generators/incorporation/build.js [appDir]   (default: app/)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = path.join(__dirname, '..', '..');
const PROTO = path.resolve(process.argv[2] || path.join(SRC, 'app'));
// the real phases and steps (extracted from src/data/checklist.ts) live next to src/: docs/specs/client-pages/prototype/incorporation-steps.json
const J = JSON.parse(fs.readFileSync(path.join(SRC, '..', 'incorporation-steps.json'), 'utf8'));

// ---------- 48 steps, flattened in order (global step N counts across phases 1-4) ----------
const STEPS = [];
J.phases.forEach((ph, pi) => {
  ph.steps.forEach((s) => {
    const info = (s.infoRequired || []).map((line) => {
      const i = line.indexOf(' — ');
      return i > -1 ? [line.slice(0, i), line.slice(i + 3)] : [line, ''];
    });
    STEPS.push({ n: STEPS.length + 1, p: pi + 1, t: s.title, d: s.description || '', o: s.responsibleRole === 'client' ? 'You' : 'SBC', tl: s.timeline, f: s.forms || [], i: info, u: !!s.urgent });
  });
});
if (STEPS.length !== 48) throw new Error('expected 48 steps');

// ---------- status model: Before (in Phase 2) and After (COI received) ----------
const { BEFORE, AFTER } = require('./model.js')(STEPS);

// ---------- step dates (due / done date of each step) ----------
const A = {
  1: '09-12', 2: '09-18', 3: '09-24', 4: '09-27', 5: '10-01',
  6: '10-04', 7: '10-09', 8: '10-14', 9: '10-15', 10: '10-17', 11: '10-19', 12: '10-20', 13: '10-23', 14: '10-24',
  15: '10-27', 16: '10-28', 17: '11-03', 18: '11-06', 19: '11-16', 20: '11-20', 21: '11-04', 22: '11-19', 23: '11-21', 24: '10-30', 25: '10-31',
  26: '11-05', 27: '11-07', 28: '11-07', 29: '11-17', 30: '11-24', 31: '11-02', 32: '12-01', 33: '11-18', 34: '11-10', 35: '12-04', 36: '11-20',
  37: '12-02', 38: '12-03', 39: '12-07', 40: '12-09', 41: '12-10', 42: '12-11', 43: '12-14', 44: '11-23', 45: '12-16', 46: '12-17', 47: '12-21', 48: '12-23',
};
const B_PH2 = { 6: '10-04', 7: '10-09', 8: '10-16', 9: '10-13', 10: '10-19', 11: '10-20', 12: '10-21', 13: '10-27', 14: '10-28' };
const iso = (md) => '2026-' + md;
function plus(d, k) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); }
const DATES_A = STEPS.map((x) => iso(A[x.n]));
const DATES_B = STEPS.map((x) => (x.n <= 5 ? iso(A[x.n]) : x.n <= 14 ? iso(B_PH2[x.n]) : plus(iso(A[x.n]), 4)));

// ---------- Lucide icons (lucide-static, ISC) ----------
const ICONS = ['check', 'clock', 'user-round', 'trending-up', 'chevron-left', 'chevron-right', 'chevron-down', 'arrow-right', 'arrow-left', 'info', 'download',
  'file-text', 'external-link', 'paperclip', 'circle-help', 'upload', 'eye', 'x', 'copy', 'lock', 'refresh-cw', 'minus', 'plus', 'maximize', 'message-square',
  'sun', 'pen-line'];
const IC = {};
ICONS.forEach((n) => {
  const svg = fs.readFileSync(path.join(SRC, 'node_modules', 'lucide-static', 'icons', n + '.svg'), 'utf8');
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
  if (!inner) throw new Error('empty icon ' + n);
  IC[n] = inner;
});

const j = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const data = 'var STEPS=' + j(STEPS) + ';\nvar BEFORE=' + j(BEFORE) + ';\nvar AFTER=' + j(AFTER) + ';\nvar DATES_B=' + j(DATES_B) + ';\nvar DATES_A=' + j(DATES_A) + ';\nvar IC=' + j(IC) + ';';
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
new vm.Script(app); // syntax check
const H = '<a href="#" data-go="home">Home</a><span class="sl">/</span>';
const I = '<a href="#" data-go="incorporation">Incorporation</a><span class="sl">/</span>';
const PAGES = {
  landing: ['incorporation.html', 'Incorporation · VCFO Suite', H + '<b id="crB">Incorporation</b>'],
  phase: ['phase.html', 'Phase · Incorporation · VCFO Suite', H + I + '<b id="crB">Phase</b>'],
  step: ['step.html', 'Step · Incorporation · VCFO Suite', H + I + '<b id="crB">Step</b>'],
  board: ['board.html', 'Board resolution · Incorporation · VCFO Suite', H + I + '<b id="crB">Board resolution</b>'],
};
for (const [kind, [file, title, crumb]] of Object.entries(PAGES)) {
  const out = tpl.replace('__TITLE__', title).replace('__CRUMB__', crumb).replace("'__PAGE__'", "'" + kind + "'")
    .replace('/*__DATA__*/', () => data).replace('/*__APP__*/', () => app);
  fs.writeFileSync(path.join(PROTO, 's/inc', file), out);
}

// ---------- routes: only the incorporation keys ----------
const rfile = path.join(PROTO, 'routes.js');
const src = fs.readFileSync(rfile, 'utf8');
const box = { window: {} };
vm.runInNewContext(src, box);
const R = box.window.__VCFO_ROUTES;
const filesLine = src.split('\n').find((l) => l.startsWith('window.__VCFO_FILES='));
if (!filesLine) throw new Error('no __VCFO_FILES line');
const PH = ['Name Application', 'Incorporation', 'Post-Incorporation', 'Registration'];
const set = (k, d, t, extra) => { R[k] = Object.assign({ d, m: d, t }, extra || {}); };
set('incorporation', 's/inc/incorporation.html', 'Incorporation');
set('inc-phase-a', 's/inc/phase.html#p=1', 'Incorporation · Phase 1 · ' + PH[0]);
set('inc-phase', 's/inc/phase.html#p=2', 'Incorporation · Phase 2 · ' + PH[1]);
set('inc-phase-3', 's/inc/phase.html#p=3', 'Incorporation · Phase 3 · ' + PH[2]);
set('inc-phase-4', 's/inc/phase.html#p=4', 'Incorporation · Phase 4 · ' + PH[3]);
STEPS.forEach((x) => set('inc-step-' + x.n, 's/inc/step.html#n=' + x.n, 'Step ' + x.n + ' · ' + x.t, { hide: true }));
set('inc-step7', 's/inc/step.html#n=7', 'Incorporation · step 7');
set('inc-step10', 's/inc/step.html#n=10', 'Incorporation · step 10');
set('board-resolution', 's/inc/board.html', 'Board resolution');
fs.writeFileSync(rfile, src.split('\n').map((l) => (l.startsWith('window.__VCFO_ROUTES=') ? 'window.__VCFO_ROUTES=' + JSON.stringify(R) + ';' : l)).join('\n'));
const check = { window: {} };
vm.runInNewContext(fs.readFileSync(rfile, 'utf8'), check);
if (!check.window.__VCFO_FILES || Object.keys(check.window.__VCFO_ROUTES).length !== Object.keys(R).length) throw new Error('routes.js check failed');
const cnt = (st, p) => STEPS.filter((x) => x.p === p && st[x.n - 1] === 'done').length;
console.log('ok · before', [1, 2, 3, 4].map((p) => cnt(BEFORE, p)).join('/'), '· after', [1, 2, 3, 4].map((p) => cnt(AFTER, p)).join('/'), '· routes', Object.keys(R).length);
