// Bundles the VCFO Suite client-portal prototype (v6) into ONE self-contained HTML file.
// Everything (boards, runtime, scripts, SVG, WebP images, fonts) is embedded; no network is used.
// Usage (from src/): node build/bundle.js [appDir] [outFile]
//   defaults: app/  ->  out/vcfo-client-portal-prototype-v7.html
// Needs: Node 18+, `npm install` in src/ (fonts), python3 with Pillow (PNG -> lossless WebP).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const SRC = path.join(__dirname, '..');
const PROTO = path.resolve(process.argv[2] || path.join(SRC, 'app'));
const OUT = path.resolve(process.argv[3] || path.join(SRC, 'out', 'vcfo-client-portal-prototype-v7.html'));
const FONTS = process.env.FONTS_DIR || path.join(SRC, 'node_modules', '@fontsource');
if (!fs.existsSync(FONTS)) throw new Error('fonts not found at ' + FONTS + ' (run `npm install` in src/, or set FONTS_DIR)');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

function walk(dir, base = dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'artifact-files') continue; walk(p, base, acc); }
    else acc.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return acc;
}
const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

// ---- text files ----
const text = {}, alias = {};
const seenText = new Map();
for (const rel of walk(PROTO)) {
  if (rel === 'index.html' || rel === 'files.json' || rel.startsWith('artifact')) continue;
  if (!/\.(html|js|svg|json|css)$/i.test(rel)) continue;
  const buf = fs.readFileSync(path.join(PROTO, rel));
  const h = sha(buf);
  if (seenText.has(h)) { alias[rel] = seenText.get(h); continue; }
  seenText.set(h, rel);
  text[rel] = buf.toString('utf8');
}

// ---- binary files: PNG -> lossless WebP (smaller, same pixels) ----
const bin = {}, mime = {};
const seenBin = new Map();
const TMP = process.env.WEBP_CACHE || path.join(SRC, '.cache', 'webp'); fs.mkdirSync(TMP, { recursive: true });
let n = 0;
for (const rel of walk(PROTO)) {
  if (!/\.png$/i.test(rel)) continue;
  const src = path.join(PROTO, rel);
  const webp = path.join(TMP, sha(fs.readFileSync(src)) + '.webp');
  if (!fs.existsSync(webp)) execFileSync('python3', ['-c', `from PIL import Image;Image.open(${JSON.stringify(src)}).save(${JSON.stringify(webp)},'WEBP',lossless=True,method=6)`]);
  const buf = fs.readFileSync(webp), h = sha(buf);
  if (seenBin.has(h)) { alias[rel] = seenBin.get(h); continue; }
  seenBin.set(h, rel); bin[rel] = buf.toString('base64'); mime[rel] = 'image/webp'; n++;
}
// ---- fonts (latin subsets, the weights the boards use) ----
const FONT_FILES = {
  'fonts/manrope-400.woff2': 'manrope/files/manrope-latin-400-normal.woff2',
  'fonts/manrope-500.woff2': 'manrope/files/manrope-latin-500-normal.woff2',
  'fonts/manrope-600.woff2': 'manrope/files/manrope-latin-600-normal.woff2',
  'fonts/manrope-700.woff2': 'manrope/files/manrope-latin-700-normal.woff2',
  'fonts/manrope-800.woff2': 'manrope/files/manrope-latin-800-normal.woff2',
  'fonts/ibm-plex-mono-500.woff2': 'ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
  'fonts/ibm-plex-mono-600.woff2': 'ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2',
  'fonts/space-grotesk-500.woff2': 'space-grotesk/files/space-grotesk-latin-500-normal.woff2',
  'fonts/space-grotesk-600.woff2': 'space-grotesk/files/space-grotesk-latin-600-normal.woff2',
  'fonts/space-grotesk-700.woff2': 'space-grotesk/files/space-grotesk-latin-700-normal.woff2',
};
for (const [k, f] of Object.entries(FONT_FILES)) { bin[k] = fs.readFileSync(path.join(FONTS, f)).toString('base64'); mime[k] = 'font/woff2'; }
// SVG inside binaries? (none: SVG stays text)

// ---- rewrite text: strip web fonts; point relative image refs at binary keys via tokens ----
const TOKEN = 'vcfo-bin:';
function normKey(p) { const o = []; for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') o.pop(); else o.push(s); } return o.join('/'); }
function resolveRel(from, rel) {
  if (!rel || /^(https?:|data:|blob:|mailto:|javascript:|#)/i.test(rel)) return null;
  rel = rel.split('#')[0].split('?')[0]; if (!rel) return null;
  const dir = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : '';
  return rel.charAt(0) === '/' ? normKey(rel) : normKey(dir + '/' + rel);
}
const isBinKey = (k) => k && (bin[k] || (alias[k] && bin[alias[k]]));
let tokens = 0;
// text resources (svg images) are served as blobs too, so <img src="x.svg"> works from file://
for (const k of Object.keys(text)) if (/\.svg$/i.test(k) && !bin[k]) { bin[k] = Buffer.from(text[k], 'utf8').toString('base64'); mime[k] = 'image/svg+xml'; }
for (const key of Object.keys(text)) {
  let t = text[key];
  t = t.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>/gi, '')
       .replace(/<link rel="preconnect"[^>]*>/gi, '')
       .replace(/@import\s+url\([^)]*\)\s*;?/gi, '');
  t = t.replace(/(\ssrc=)(["'])([^"']+)\2/gi, (m, pre, q, u) => {
    const k = resolveRel(key, u); if (!isBinKey(k)) return m; tokens++; return pre + q + TOKEN + k + q; });
  t = t.replace(/url\((["']?)([^"')]+)\1\)/gi, (m, q, u) => {
    if (/^(data:|https?:|blob:|#)/i.test(u)) return m;
    const k = resolveRel(key, u); if (!isBinKey(k)) return m; tokens++; return 'url(' + q + TOKEN + k + q + ')'; });
  text[key] = t;
}
console.log('image tokens', tokens);
const DATA = JSON.stringify({ text, alias, bin, mime });
const tpl = fs.readFileSync(path.join(__dirname, 'shell.html'), 'utf8');
if (!tpl.includes('__DATA__')) throw new Error('shell template missing __DATA__');
// JSON inside <script type=application/json>: escape "</" so the element cannot close early
const html = tpl.replace('__DATA__', () => DATA.replace(/</g, '\\u003c'));
fs.writeFileSync(OUT, html);
console.log('files', Object.keys(text).length, 'aliases', Object.keys(alias).length, 'images', n, 'bytes', html.length);
