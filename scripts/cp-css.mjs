#!/usr/bin/env node
/**
 * Client portal CSS scoper.
 *
 * The client portal replicates the owner's prototype
 * (docs/specs/client-pages/prototype/final-src) pixel for pixel, so its CSS is
 * copied verbatim into `src/components/client-portal/css-src/*.css`. Those
 * files use global selectors (`:root`, `body`, `.card`, `th`, …). This script
 * rewrites each file so every rule only applies inside the portal root
 * (`.cp`, set by `ClientPortalShell`) and, for page files, inside that page's
 * root class (`.cp .cp-home`). Keyframes get a per-file suffix so boards that
 * reuse a name (`up`, `grow`) with different motion never clash.
 *
 *   node scripts/cp-css.mjs            # rebuild every file in css-src → css
 *
 * Header line in a source file chooses the scope:
 *   /* @cp-scope page=home *\/   → `.cp .cp-home …`
 *   /* @cp-scope shared *\/      → `.cp …` (default)
 *   /* @cp-scope shared base *\/ → `.cp …`, minus the pages that define the class
 *
 * `base` is the prototype's shared board stylesheet (b/ecdc…css). Only some
 * prototype boards loaded it (Home desktop, Team, the viewer pop-ups); the
 * others (Incorporation, Compliances, Documents, Library, phone Home…) carry
 * their own rules under the same class names (`.ic`, `.card`, `.st`, `.sub`).
 * A base rule naming a class that a page file also defines therefore gets
 * `:where(:not(.cp-<page> *))` on its subject, so inside that page only the
 * page's own rule applies, as in the prototype. Zero specificity is added.
 */
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src/components/client-portal/css-src');
const OUT = path.join(ROOT, 'src/components/client-portal/css');

function splitTop(sel) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** `html[data-theme="dark"] .x` → `.cp[data-theme="dark"] <page> .x` */
function scopeSelector(sel, page) {
  const base = '.cp';
  const pageSel = page ? ` .cp-${page}` : '';
  // :root / html / body (with optional attribute or class qualifiers) start the selector
  if (/^\[data-theme/.test(sel)) sel = 'html' + sel;
  const m = sel.match(/^(?::root|html|body)((?:\[[^\]]*\]|\.[\w-]+|:not\([^)]*\))*)(?:\s+(?:body)((?:\[[^\]]*\]|\.[\w-]+)*))?(\s*)(.*)$/s);
  if (m) {
    const quals = (m[1] || '') + (m[2] || '');
    const gap = m[3] || '';
    const rest = (m[4] || '').trim();
    // `:root` holds tokens: on a page file they belong on the page root itself
    const host = page ? `${base}${quals.replace(/\.vp-[\w-]+/g, '')}${pageSel}` : `${base}${quals}`;
    if (!rest) return host;
    if (!gap && rest.startsWith(':')) return `${host}${rest}`;
    return `${host} ${rest}`;
  }
  return `${base}${pageSel} ${sel}`;
}

/** pages whose prototype board loaded the base itself, so their files are deltas on top of it */
const BASE_PAGES = new Set(['home', 'team', 'docviewer', 'ids']);

/** class name → pages (not loading the base) whose own stylesheet defines it */
function pageClassMap() {
  const map = new Map();
  for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith('.css'))) {
    const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
    const m = raw.match(/@cp-scope\s+page=([\w-]+)/);
    if (!m || BASE_PAGES.has(m[1])) continue;
    const root = postcss.parse(raw, { from: f });
    root.walkRules((rule) => {
      if (rule.parent && rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
      for (const k of selectorKeys(rule.selector)) {
        if (!map.has(k)) map.set(k, new Set());
        map.get(k).add(m[1]);
      }
    });
  }
  return map;
}

/** class names (`card`) and bare element names (`<th>`) a selector styles */
function selectorKeys(sel) {
  const keys = (sel.match(/\.[A-Za-z][\w-]*/g) || []).map((c) => c.slice(1));
  for (const m of sel.matchAll(/(?:^|[\s>+~,])([a-z][a-z0-9]*)(?=$|[\s>+~,:.[])/g)) if (!/^(html|body)$/.test(m[1])) keys.push(`<${m[1]}>`);
  return keys;
}

/** append `:where(:not(.cp-a *,.cp-b *))` to the subject compound (before any ::pseudo-element) */
function excludePages(sel, pages) {
  if (!pages.size) return sel;
  const not = `:where(:not(${[...pages].map((p) => `.cp-${p} *`).join(',')}))`;
  const pe = sel.match(/::?(?:before|after|placeholder|marker|selection|-webkit-[\w-]+)$/);
  return pe ? sel.slice(0, pe.index) + not + pe[0] : sel + not;
}

let PAGE_CLASSES = null;

function processFile(file) {
  const raw = fs.readFileSync(path.join(SRC, file), 'utf8');
  const head = raw.match(/@cp-scope\s+(page=([\w-]+)|shared)/);
  const isBase = /@cp-scope\s+shared\s+base\b/.test(raw);
  if (isBase && !PAGE_CLASSES) PAGE_CLASSES = pageClassMap();
  const page = head && head[2] ? head[2] : null;
  const suffix = !page ? '' : '-' + path.basename(file, '.css').replace(/[^\w-]/g, '');
  const root = postcss.parse(raw, { from: file });
  const names = new Set();
  root.walkAtRules(/keyframes$/, (at) => {
    names.add(at.params.trim());
  });
  root.walkAtRules(/keyframes$/, (at) => {
    at.params = at.params.trim() + suffix;
  });
  root.walkRules((rule) => {
    if (rule.parent && rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    rule.selector = splitTop(rule.selector)
      .map((s) => {
        const scoped = scopeSelector(s, page);
        if (!isBase || /^(?::root|html|body)\b/.test(s)) return scoped;
        const pages = new Set();
        for (const k of selectorKeys(s)) for (const p of PAGE_CLASSES.get(k) || []) pages.add(p);
        return excludePages(scoped, pages);
      })
      .join(',\n');
  });
  if (names.size) {
    const re = new RegExp(`(^|[\\s,])(${[...names].map((n) => n.replace(/[-]/g, '\\-')).join('|')})(?=$|[\\s,;])`, 'g');
    root.walkDecls(/^(animation|animation-name)$/, (d) => {
      d.value = d.value.replace(re, (_, pre, n) => `${pre}${n}${suffix}`);
    });
  }
  const out = `/* GENERATED by scripts/cp-css.mjs from css-src/${file} · do not edit */\n` + root.toString();
  fs.writeFileSync(path.join(OUT, file), out);
  return { file, page, rules: root.nodes.length };
}

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith('.css'))) {
  if (only.length && !only.includes(f)) continue;
  const r = processFile(f);
  console.log(`${r.file} → css/${r.file}${r.page ? ` (page ${r.page})` : ''}`);
}
