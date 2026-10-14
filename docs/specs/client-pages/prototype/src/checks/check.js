// Re-test only the screens you changed.
//   1) responsive matrix: each route at 14 sizes (phone, tablet, laptop, desktop, 2560) in Before and After
//   2) click audit: every control on each route, desktop and phone, Before and After
// Usage (from src/): node checks/check.js <route1,route2> [--bundle out/x.html] [--no-resp] [--no-click]
// Pass: responsive entries all have hscroll false, over 0, tiny 0; audits show dead 0, errors 0, requests 0. Exit code 1 otherwise.
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const routes = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--bundle');
if (!routes) { console.error('usage: node checks/check.js <route1,route2> [--bundle file] [--no-resp] [--no-click]'); process.exit(2); }
const bi = args.indexOf('--bundle');
const BUNDLE = path.resolve(bi >= 0 ? args[bi + 1] : path.join(__dirname, '..', 'out', 'vcfo-client-portal-prototype-v7.html'));
if (!fs.existsSync(BUNDLE)) { console.error('bundle not found: ' + BUNDLE + ' (build it first: node build/bundle.js)'); process.exit(2); }
const OUTDIR = path.join(__dirname, '..', 'out', 'checks'); fs.mkdirSync(OUTDIR, { recursive: true });
const env = Object.assign({}, process.env, { BUNDLE, STATES: 'before,after', TAG: 'check', CHECKS_OUT: OUTDIR });
const run = (script, argv) => new Promise((res) => {
  const p = spawn(process.execPath, [path.join(__dirname, script)].concat(argv), { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = ''; p.stderr.on('data', (d) => { err += d; });
  p.stdout.on('data', (d) => process.stdout.write('  · ' + script + ' ' + argv.slice(0, 2).join(' ') + ': ' + String(d).trim().split('\n').pop() + '\n'));
  p.on('close', (code) => res({ code, err }));
});
(async () => {
  let fail = 0;
  const jobs = [];
  const respOut = path.join(OUTDIR, 'check-resp.json');
  if (!args.includes('--no-resp')) jobs.push(run('resp.js', ['0', '1', respOut, routes]).then((r) => ({ kind: 'resp', r })));
  if (!args.includes('--no-click')) for (const d of ['desktop', 'mobile']) for (const s of ['before', 'after']) jobs.push(run('audit.js', [d, s, routes]).then((r) => ({ kind: 'audit', d, s, r })));
  const done = await Promise.all(jobs);
  console.log('\nRESULTS for ' + routes + '  (' + path.relative(process.cwd(), BUNDLE) + ')');
  for (const j of done) {
    if (j.r.code !== 0) { fail++; console.log('  ' + j.kind + (j.d ? ' ' + j.d + ' ' + j.s : '') + ': CRASHED\n' + j.r.err.slice(-600)); continue; }
    if (j.kind === 'resp') {
      const R = JSON.parse(fs.readFileSync(respOut, 'utf8'));
      const bad = R.filter((e) => e.error || e.hscroll || e.over || e.tiny);
      console.log(`  responsive: ${R.length} checks, ${bad.length} failing`);
      for (const e of bad.slice(0, 20)) console.log(`    ${e.route} ${e.w}x${e.h} ${e.st}: ${e.error || ''}${e.hscroll ? ' page scrolls sideways' : ''}${e.over ? ' ' + e.over + ' overflowing (' + (e.overS || []).slice(0, 2).join('; ') + ')' : ''}${e.tiny ? ' ' + e.tiny + ' tiny text (' + (e.tinyS || []).slice(0, 2).join('; ') + ')' : ''}`);
      fail += bad.length;
    } else {
      const A = JSON.parse(fs.readFileSync(path.join(OUTDIR, `check-${j.d}-${j.s}.json`), 'utf8'));
      const nf = A.results.filter((r) => r.error);
      console.log(`  audit ${j.d} ${j.s}: ${A.clicksTotal} clicks, dead ${A.deadTotal}, errors ${A.errors.length}, requests ${A.requests.length}${nf.length ? ', no frame: ' + nf.map((r) => r.route).join(',') : ''}`);
      for (const r of A.results) for (const d of (r.dead || [])) console.log(`    dead: ${r.route} | ${d.label}`);
      for (const e of [...new Set(A.errors)].slice(0, 5)) console.log('    error: ' + e.slice(0, 200));
      fail += A.deadTotal + A.errors.length + A.requests.length + nf.length;
    }
  }
  console.log(fail ? `\nFAIL (${fail})` : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
