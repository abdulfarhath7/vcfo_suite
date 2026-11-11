// Shared brand kit for the VCFO Suite collateral (brochure, corporate deck, one-pager).
// Every colour, icon, badge and card the three generators draw comes from here.
const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const Lu = require('react-icons/lu');

const REPO = process.env.VCFO_REPO || path.resolve(__dirname, '../../../..');
const LOGO_DIR = path.join(REPO, 'docs/specs/brand/logo');

// Set COMING_SOON=0 once receivables, payroll + labour registers, automation wave 2 and
// the Ask VCFO drop are live on app.sbctrack.in. With it on, those items carry a small
// "Coming soon" tag, as docs/context/STATE.md lists them as built but not yet deployed.
const SOON = process.env.COMING_SOON !== '0';

// Brand palette (hex, no '#').
const HEX = {
  navy: '15263B',
  navy2: '1E3350', // card on navy
  navy3: '2A4263', // hairline on navy
  orange: 'E9792F',
  yellow: 'FFC517',
  orange2: 'F08A21',
  deep: 'E76028',
  white: 'FFFFFF',
  off: 'FBF7F1',
  offDeep: 'F4ECE1',
  tint: 'FDF1E7', // orange tint for call-outs
  line: 'E6DFD4',
  ink: '15263B',
  muted: '56677C',
  soft: 'A9B6C6', // muted text on navy
  green: '2E8B57',
  amber: 'C98A12',
  red: 'C8443A',
  blue: '2F6FB5',
  grey: '8A96A3',
  teal: '1F8A8A',
};

// Theme colours: dk1 navy, lt1 white, dk2 muted, lt2 warm off-white, accents = orange + status.
const THEME = {
  name: 'VCFO Suite',
  headFontFace: 'Public Sans',
  bodyFontFace: 'Public Sans',
  colors: {
    dk1: HEX.navy,
    lt1: HEX.white,
    dk2: HEX.muted,
    lt2: HEX.off,
    accent1: HEX.orange,
    accent2: HEX.blue,
    accent3: HEX.green,
    accent4: HEX.amber,
    accent5: HEX.red,
    accent6: HEX.grey,
    hlink: HEX.blue,
    folHlink: HEX.muted,
  },
};

const MONO = 'IBM Plex Mono';

function scheme(pres) {
  const S = pres.SchemeColor;
  return {
    navy: S.text1,
    white: S.background1,
    muted: S.text2,
    off: S.background2,
    orange: S.accent1,
    blue: S.accent2,
    green: S.accent3,
    amber: S.accent4,
    red: S.accent5,
    grey: S.accent6,
    // Non-theme brand tones stay hex.
    navy2: HEX.navy2,
    navy3: HEX.navy3,
    yellow: HEX.yellow,
    orange2: HEX.orange2,
    deep: HEX.deep,
    tint: HEX.tint,
    line: HEX.line,
    offDeep: HEX.offDeep,
    soft: HEX.soft,
    teal: HEX.teal,
  };
}

// ---------- images ----------
function fileData(p) {
  const ext = path.extname(p).slice(1).toLowerCase();
  return `image/${ext === 'jpg' ? 'jpeg' : ext};base64,` + fs.readFileSync(p).toString('base64');
}
const LOGO = {
  onWhite: fileData(path.join(LOGO_DIR, 'vcfo-logo-on-white.png')),
  onBlack: fileData(path.join(LOGO_DIR, 'vcfo-logo-on-black.png')),
  icon: fileData(path.join(LOGO_DIR, 'vcfo-icon.png')),
  ratio: 2248 / 620,
  iconRatio: 1222 / 1394,
};

const iconCache = new Map();
function pickIcon(names) {
  for (const n of [].concat(names)) if (Lu[n]) return Lu[n];
  throw new Error('No icon for ' + names);
}
async function icon(names, color, size = 256) {
  const key = [].concat(names).join('|') + color + size;
  if (iconCache.has(key)) return iconCache.get(key);
  const Comp = pickIcon(names);
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color: '#' + color, size: String(size), strokeWidth: 1.75 }),
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const data = 'image/png;base64,' + buf.toString('base64');
  iconCache.set(key, data);
  return data;
}

// The one thin rule allowed by the brand: yellow -> orange -> deep orange.
async function gradientRule() {
  const w = 1200, h = 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#${HEX.yellow}"/><stop offset="0.5" stop-color="#${HEX.orange2}"/><stop offset="1" stop-color="#${HEX.deep}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

// Pre-render every icon a generator needs, so drawing code stays synchronous.
const ICONS = {
  checklist: ['LuListChecks'],
  doc: ['LuFileText'],
  docs: ['LuFiles', 'LuFileStack', 'LuFileText'],
  zip: ['LuFolderArchive', 'LuArchive'],
  building: ['LuBuilding2', 'LuBuilding'],
  calendar: ['LuCalendarCheck', 'LuCalendarCheck2', 'LuCalendar'],
  board: ['LuPresentation', 'LuUsers'],
  users: ['LuUsers'],
  user: ['LuUserRound', 'LuUser'],
  wallet: ['LuWallet', 'LuWalletMinimal'],
  bank: ['LuLandmark'],
  rupee: ['LuIndianRupee'],
  coins: ['LuCoins'],
  bell: ['LuBellRing', 'LuBell'],
  bot: ['LuBot', 'LuSparkles'],
  sparkles: ['LuSparkles'],
  phone: ['LuSmartphone'],
  shield: ['LuShieldCheck'],
  lock: ['LuLockKeyhole', 'LuLock'],
  key: ['LuKeyRound', 'LuKey'],
  mail: ['LuMail'],
  message: ['LuMessageSquare', 'LuMessageCircle'],
  folder: ['LuFolderOpen'],
  upload: ['LuUpload', 'LuFileUp'],
  clock: ['LuClock'],
  check: ['LuCircleCheck', 'LuCheckCircle2', 'LuCheckCircle'],
  tick: ['LuCheck'],
  alert: ['LuTriangleAlert', 'LuAlertTriangle'],
  route: ['LuRoute', 'LuMap'],
  map: ['LuMap'],
  layers: ['LuLayers'],
  gauge: ['LuGauge'],
  chart: ['LuChartColumn', 'LuBarChart3', 'LuChartBar'],
  heart: ['LuHeartPulse', 'LuActivity'],
  stamp: ['LuStamp', 'LuBadgeCheck'],
  badge: ['LuBadgeCheck'],
  repeat: ['LuRepeat', 'LuRefreshCw'],
  send: ['LuSend'],
  video: ['LuVideo'],
  pen: ['LuPenLine', 'LuPenTool', 'LuPen'],
  vote: ['LuVote', 'LuThumbsUp'],
  scale: ['LuScale'],
  flag: ['LuFlag'],
  globe: ['LuGlobe'],
  server: ['LuServer', 'LuDatabase'],
  database: ['LuDatabase'],
  history: ['LuHistory', 'LuScrollText'],
  eye: ['LuEye'],
  inbox: ['LuInbox'],
  sun: ['LuSun', 'LuSunrise'],
  link: ['LuLink'],
  receipt: ['LuReceiptIndianRupee', 'LuReceipt'],
  idcard: ['LuIdCard', 'LuContact'],
  handshake: ['LuHandshake'],
  briefcase: ['LuBriefcaseBusiness', 'LuBriefcase'],
  search: ['LuSearch'],
  target: ['LuTarget'],
  rocket: ['LuRocket'],
  play: ['LuMonitorPlay', 'LuPlay'],
  stethoscope: ['LuStethoscope', 'LuHeartPulse'],
  arrowRight: ['LuArrowRight'],
  table: ['LuTable', 'LuSheet'],
  file: ['LuFile'],
  x: ['LuX'],
};
const ICON_COLORS = [HEX.navy, HEX.white, HEX.orange, HEX.green, HEX.blue, HEX.amber, HEX.red, HEX.muted, HEX.teal, HEX.soft];
async function loadIcons() {
  const out = {};
  for (const [k, names] of Object.entries(ICONS)) {
    out[k] = {};
    for (const c of ICON_COLORS) out[k][c] = await icon(names, c);
  }
  out.rule = await gradientRule();
  return out;
}

// ---------- drawing helpers (all sizes in inches / points) ----------
function mkDraw(pres, I) {
  const C = scheme(pres);
  const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, valign: 'top', ...o });

  // Small icon, optionally inside a filled circle or rounded square.
  function ico(slide, name, x, y, s, color = HEX.navy, bg = null, pad = 0.22) {
    if (bg) {
      slide.addShape(pres.shapes.OVAL, { x, y, w: s, h: s, fill: { color: bg }, line: { color: bg, width: 0 } });
      const inner = s * (1 - 2 * pad);
      slide.addImage({ data: I[name][color], x: x + s * pad, y: y + s * pad, w: inner, h: inner, altText: name + ' icon' });
    } else {
      slide.addImage({ data: I[name][color], x, y, w: s, h: s, altText: name + ' icon' });
    }
  }

  // Pill with text. Returns width used.
  function pill(slide, text, x, y, { h = 0.24, size = 7.5, fill = null, color = C.orange, line = null, bold = true, font = undefined, w = null, charSpacing = 0.5 } = {}) {
    const ww = w || Math.max(0.5, text.length * size * 0.0098 + 0.26);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: ww, h, rectRadius: h / 2,
      fill: fill ? { color: fill } : { type: 'none' },
      line: line ? { color: line, width: 0.75 } : { type: 'none' },
    });
    T(slide, text, { x, y, w: ww, h, fontSize: size, bold, color, align: 'center', valign: 'middle', fontFace: font, charSpacing, fit: 'none' });
    return ww;
  }

  // Monospaced code badge, e.g. "U1".
  function code(slide, text, x, y, { fill = C.navy, color = C.white, size = 7, h = 0.2, w = null } = {}) {
    const ww = w || Math.max(0.32, text.length * size * 0.0092 + 0.14);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: ww, h, rectRadius: 0.04, fill: { color: fill }, line: { type: 'none' } });
    T(slide, text, { x, y, w: ww, h, fontSize: size, bold: true, color, fontFace: MONO, align: 'center', valign: 'middle' });
    return ww;
  }

  function soon(slide, x, y, { size = 6.5, h = 0.19 } = {}) {
    if (!SOON) return 0;
    return pill(slide, 'COMING SOON', x, y, { h, size, fill: 'FFF4DC', color: C.amber, line: HEX.amber, charSpacing: 0.6 });
  }

  // Card: white (or given) fill, hairline border, coloured top bar, optional code badge, icon, title, body.
  function card(slide, o) {
    const {
      x, y, w, h, bar = C.orange, fill = C.white, border = C.line, codeText, codeFill = C.navy, codeColor = C.white,
      title, body, iconName, iconColor = HEX.navy, iconBg = null, titleSize = 10.5, bodySize = 8.5, pad = 0.16,
      titleColor = C.navy, bodyColor = C.muted, barH = 0.06, soonTag = false, bodyLines = null, iconSize = 0.32,
    } = o;
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill }, line: border ? { color: border, width: 0.75 } : { type: 'none' } });
    if (bar) slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: barH, fill: { color: bar }, line: { type: 'none' } });
    let cy = y + barH + pad - 0.02;
    let rowH = 0;
    let cx = x + pad;
    if (iconName) {
      ico(slide, iconName, cx, cy, iconSize, iconColor, iconBg);
      rowH = iconSize;
    }
    let right = x + w - pad;
    if (codeText) {
      const cw = Math.max(0.32, codeText.length * 7 * 0.0092 + 0.14);
      code(slide, codeText, right - cw, cy, { fill: codeFill, color: codeColor });
      right -= cw + 0.06;
      rowH = Math.max(rowH, 0.2);
    }
    if (soonTag && SOON) {
      const sw = 'COMING SOON'.length * 6.5 * 0.0098 + 0.26;
      soon(slide, right - sw, cy);
      rowH = Math.max(rowH, 0.2);
    }
    if (rowH) cy += rowH + 0.1;
    if (title) {
      const th = titleSize / 72 * 1.25 * (o.titleLines || 1) + 0.02;
      T(slide, title, { x: x + pad, y: cy, w: w - 2 * pad, h: th, fontSize: titleSize, bold: true, color: titleColor });
      cy += th + 0.05;
    }
    if (body || bodyLines) {
      const content = bodyLines
        ? bodyLines.map((t, i) => ({ text: t, options: { bullet: { indent: 9 }, breakLine: i < bodyLines.length - 1, paraSpaceAfter: 2 } }))
        : body;
      T(slide, content, { x: x + pad, y: cy, w: w - 2 * pad, h: y + h - cy - pad * 0.6, fontSize: bodySize, color: bodyColor, lineSpacingMultiple: 1.12 });
    }
  }

  return { C, T, ico, pill, code, soon, card };
}

module.exports = { HEX, THEME, MONO, SOON, LOGO, scheme, loadIcons, mkDraw };
