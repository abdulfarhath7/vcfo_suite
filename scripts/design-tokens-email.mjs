// Emits src/lib/email/spectrum-email-tokens.ts from docs/design/design-tokens.json.
//   node scripts/design-tokens-email.mjs            # print the module
//   node scripts/design-tokens-email.mjs --write    # write src/lib/email/spectrum-email-tokens.ts
//   node scripts/design-tokens-email.mjs --check    # exit 1 when the file has drifted from the JSON
// Email clients do not read CSS variables or oklch(), so every colour token is converted from its
// OKLCH triplet (what the app paints) to an sRGB hex. Aliases such as {ink} resolve to the target.
// src/lib/email/spectrum-email-tokens.test.ts fails when the generated file and the JSON disagree.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_PATH = path.join(root, 'docs/design/design-tokens.json');
const OUT_PATH = path.join(root, 'src/lib/email/spectrum-email-tokens.ts');
const MODES = ['light', 'dark'];

/**
 * Email type stacks from `type.fonts`. The app's families start with CSS variables, which mail
 * clients cannot read, so the email stacks name the faces directly: the ui face (Roboto) for text
 * and the mono face (Roboto Mono) for identifiers (CIN, DIN, PAN, SRN, ARN), each loaded from
 * Google Fonts where the client allows it and falling back to web-safe faces everywhere else.
 * Single quotes only: the stacks go inside style="...".
 */
function emailFonts(json) {
  const fonts = json.type?.fonts ?? [];
  const face = (family, fallback) => fonts.find((f) => f.family === family)?.name ?? fallback;
  const weights = (family, fallback) => {
    const found = (fonts.find((f) => f.family === family)?.source ?? '').match(/\b[1-9]00\b/g);
    return (found?.length ? found : fallback).join(';');
  };
  const ui = face('ui', 'Roboto');
  const mono = face('mono', 'Roboto Mono');
  const gf = (name, family, fallback) => `family=${name.replaceAll(' ', '+')}:wght@${weights(family, fallback)}`;
  return {
    sans: `'${ui}', Arial, Helvetica, sans-serif`,
    mono: `'${mono}', 'Courier New', Courier, monospace`,
    /** Outlook on Windows falls back to Times when the first face is a web font, so it gets this. */
    outlook: 'Arial, Helvetica, sans-serif',
    googleHref: `https://fonts.googleapis.com/css2?${gf(ui, 'ui', ['400', '500', '700'])}&${gf(mono, 'mono', ['500'])}&display=swap`,
  };
}

/** OKLCH channel triplet ("57.8% 0.235 278") to an sRGB hex, clamped to the gamut. */
export function oklchToHex(triplet) {
  const [lRaw, cRaw, hRaw] = triplet.trim().split(/\s+/);
  const L = lRaw.endsWith('%') ? parseFloat(lRaw) / 100 : parseFloat(lRaw);
  const C = parseFloat(cRaw);
  const h = (parseFloat(hRaw) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    '#' +
    linear
      .map((x) => {
        const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055;
        const byte = Math.round(Math.min(Math.max(v, 0), 1) * 255);
        return byte.toString(16).padStart(2, '0');
      })
      .join('')
  );
}

/** Builds the plain-data email tokens from the parsed design-tokens.json. */
export function buildEmailTokens(json) {
  const byName = new Map(json.color.tokens.map((t) => [t.name, t]));
  const colorOf = (name, mode, seen = new Set()) => {
    const t = byName.get(name);
    if (!t || seen.has(name)) return null;
    seen.add(name);
    const raw = t.value?.[mode];
    const alias = typeof raw === 'string' ? /^\{(.+)\}$/.exec(raw) : null;
    if (alias) return colorOf(alias[1], mode, seen);
    if (t.oklch?.[mode]) return oklchToHex(t.oklch[mode]);
    return null; // gradients and rgba() strings are not flat colours
  };

  const colors = {};
  for (const mode of MODES) {
    colors[mode] = {};
    for (const t of json.color.tokens) {
      const hex = colorOf(t.name, mode);
      if (hex) colors[mode][t.name] = hex;
    }
  }

  // The DashHero wash: the radial gradients without their base colour. The layout paints
  // brand-soft underneath, which is all that clients without gradients (Outlook) show.
  const hero = {};
  const heroToken = byName.get('hero-gradient');
  for (const mode of MODES) {
    const raw = heroToken?.value?.[mode] ?? '';
    const base = /,\s*#[0-9a-fA-F]{3,8}\s*$/.exec(raw);
    hero[mode] = base ? raw.slice(0, base.index).trim() : raw;
  }

  const pick = (group, names) =>
    Object.fromEntries(
      (json[group]?.tokens ?? []).filter((t) => names.includes(t.name)).map((t) => [t.name, t.value]),
    );

  return {
    colors,
    hero,
    radius: pick('radius', ['radius-sm', 'radius-md', 'radius-lg', 'radius-mark']),
    borderWidth: pick('borderWidth', ['hairline', 'rule-width']),
    fonts: emailFonts(json),
  };
}

const q = (v) => {
  const s = String(v).replaceAll('\\', '\\\\');
  return s.includes("'") ? `"${s.replaceAll('"', '\\"')}"` : `'${s}'`;
};
const key = (k) => (/^[a-zA-Z_$][\w$]*$/.test(k) ? k : q(k));
const obj = (o, indent) =>
  `{\n${Object.entries(o)
    .map(([k, v]) => `${indent}  ${key(k)}: ${typeof v === 'object' ? obj(v, `${indent}  `) : q(v)},`)
    .join('\n')}\n${indent}}`;

/** The TypeScript module text for the tokens. */
export function renderEmailTokensModule(tokens, source = 'docs/design/design-tokens.json') {
  return `// Generated by scripts/design-tokens-email.mjs from ${source}. Do not edit by hand:
// change the JSON, then run \`npm run tokens:email\`. spectrum-email-tokens.test.ts fails on drift.
// Hex values are the OKLCH tokens converted to sRGB, because mail clients read neither CSS
// variables nor oklch().

export const SPECTRUM_EMAIL_COLORS = ${obj(tokens.colors, '')} as const;

export type SpectrumEmailColorName = keyof (typeof SPECTRUM_EMAIL_COLORS)['light'];

/** The DashHero colour wash (gradient layers only); the layout puts brand-soft underneath. */
export const SPECTRUM_EMAIL_HERO = ${obj(tokens.hero, '')} as const;

export const SPECTRUM_EMAIL_RADIUS = ${obj(tokens.radius, '')} as const;

export const SPECTRUM_EMAIL_BORDER = ${obj(tokens.borderWidth, '')} as const;

export const SPECTRUM_EMAIL_FONTS = ${obj(tokens.fonts, '')} as const;
`;
}

function main() {
  const json = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  const text = renderEmailTokensModule(buildEmailTokens(json));
  const args = new Set(process.argv.slice(2));
  if (args.has('--write')) {
    writeFileSync(OUT_PATH, text);
    console.log(`wrote ${path.relative(root, OUT_PATH)}`);
  } else if (args.has('--check')) {
    let current = '';
    try {
      current = readFileSync(OUT_PATH, 'utf8');
    } catch {
      /* missing file counts as drift */
    }
    if (current !== text) {
      console.error(`${path.relative(root, OUT_PATH)} is out of date: run npm run tokens:email`);
      process.exit(1);
    }
    console.log('email tokens are up to date');
  } else {
    process.stdout.write(text);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
