// Proves two bundles embed the same content (ignores file order): compares every embedded text file, image and font.
// Usage (from src/): node checks/compare-bundles.js <a.html> <b.html>
//   prints added / removed / changed entries; exit code 1 when anything differs
const fs = require('fs');
function load(file) {
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<script type="application\/json" id="pf">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no embedded data in ' + file);
  const D = JSON.parse(m[1]);
  const text = {}, bin = {};
  for (const k of Object.keys(D.text)) text[k] = D.text[k];
  for (const [k, v] of Object.entries(D.alias)) if (D.text[v] !== undefined) text[k] = D.text[v]; else if (D.bin[v] !== undefined) bin[k] = D.bin[v];
  for (const k of Object.keys(D.bin)) bin[k] = D.bin[k];
  const shell = html.replace(m[1], '');
  return { text, bin, shell };
}
const [a, b] = [load(process.argv[2]), load(process.argv[3])];
let diffs = 0;
for (const kind of ['text', 'bin']) {
  const A = a[kind], B = b[kind];
  const added = Object.keys(B).filter((k) => !(k in A)), removed = Object.keys(A).filter((k) => !(k in B));
  const changed = Object.keys(A).filter((k) => k in B && A[k] !== B[k]);
  console.log(`${kind}: ${Object.keys(A).length} vs ${Object.keys(B).length} · added ${added.length} · removed ${removed.length} · changed ${changed.length}`);
  for (const k of added) console.log('  + ' + k);
  for (const k of removed) console.log('  - ' + k);
  for (const k of changed) console.log('  ~ ' + k);
  diffs += added.length + removed.length + changed.length;
}
const shellSame = a.shell === b.shell;
console.log('outer page (shell.html):', shellSame ? 'same' : 'DIFFERENT');
process.exit(diffs || !shellSame ? 1 : 0);
