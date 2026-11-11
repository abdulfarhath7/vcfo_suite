// Shared brand kit for the VCFO Suite collateral, on the app's VCFO Spectrum design system (brochure, corporate deck, one-pager).
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

// Palette = the app's VCFO Spectrum tokens (docs/design/design-tokens.json, light theme).
// Hex, no '#'. Names on the left are the generators' names; the token is in the comment.
const HEX = {
  navy: '0A2540', // ink, navy-fill, side
  navy2: '0F2D4D', // side-deep: a card on navy
  navy3: '17375C', // side-line: hairline on navy
  orange: 'F26B1D', // highlight-bright: marks, big figures, 3px top edges
  orangeText: 'B54708', // highlight: orange small text on light grounds
  brand: '635BFF', // brand: the one action colour
  brandText: '4A3FE0', // brand-text
  brandSoft: 'EFEEFF', // brand-soft: the wash behind a call-out
  white: 'FFFFFF', // surface-raised
  off: 'F6F8FB', // surface
  sunken: 'F1F4F8', // surface-sunken: table heads, wells
  tint: 'EFEEFF', // call-out ground (brand-soft)
  line: 'E3E8EF', // line
  ink: '0A2540',
  muted: '5E6E85', // ink-muted
  soft: 'C6D1E0', // side-ink: text on navy
  green: '0B7A43', // positive (Done)
  amber: '9A4D00', // warning (Due soon)
  red: 'C0182F', // danger (Overdue)
  blue: '0A5FC2', // info (In progress)
  grey: '4E5D73', // upcoming (Not started)
  teal: '06708C', // waiting (Waiting)
  caution: '7A4100',
  cautionSoft: 'FFF6E0',
  cautionLine: 'F5DC9C',
  dangerSoft: 'FFE6E9',
};

const THEME = {
  name: 'VCFO Spectrum',
  headFontFace: 'Roboto',
  bodyFontFace: 'Roboto',
  colors: {
    dk1: HEX.navy,
    lt1: HEX.white,
    dk2: HEX.muted,
    lt2: HEX.off,
    accent1: HEX.orange,
    accent2: HEX.brand,
    accent3: HEX.green,
    accent4: HEX.amber,
    accent5: HEX.red,
    accent6: HEX.blue,
    hlink: HEX.brandText,
    folHlink: HEX.muted,
  },
};

const MONO = 'Roboto Mono';
const R6 = 6 / 96; // the one radius, 6px (R-44)
const BAR = 3 / 96; // stat-rule, the 3px coloured top edge
const HAIR = 1.125; // hairline, 1.5px in points

function scheme(pres) {
  const S = pres.SchemeColor;
  return {
    navy: S.text1,
    white: S.background1,
    muted: S.text2,
    off: S.background2,
    orange: S.accent1,
    brand: S.accent2,
    green: S.accent3,
    amber: S.accent4,
    red: S.accent5,
    blue: S.accent6,
    // Non-theme tokens stay hex.
    grey: HEX.grey,
    teal: HEX.teal,
    orangeText: HEX.orangeText,
    brandText: HEX.brandText,
    brandSoft: HEX.brandSoft,
    navy2: HEX.navy2,
    navy3: HEX.navy3,
    sunken: HEX.sunken,
    tint: HEX.tint,
    line: HEX.line,
    soft: HEX.soft,
    caution: HEX.caution,
    cautionSoft: HEX.cautionSoft,
    cautionLine: HEX.cautionLine,
    dangerSoft: HEX.dangerSoft,
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

// Spectrum has no gradients, so the cover rule is a solid highlight-bright edge.
async function gradientRule() {
  const buf = await sharp({ create: { width: 1200, height: 12, channels: 3, background: '#' + HEX.orange } }).png().toBuffer();
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
const ICON_COLORS = [...new Set(Object.values(HEX))];
async function loadIcons() {
  const out = {};
  for (const [k, names] of Object.entries(ICONS)) {
    out[k] = {};
    for (const c of ICON_COLORS) out[k][c] = await icon(names, c);
  }
  out.rule = await gradientRule();
  return out;
}

// ---------- Spectrum shape rules ----------
// Every box gets the one 6px radius and a 1.5px hairline; a 3px coloured top edge is drawn the
// way the app draws a KPI card's stat-rule. Full-bleed bands stay square.
// Snap a font size onto the document's type scale: a list of [upper bound, size] steps.
function snapSize(scale, v) {
  if (!scale || typeof v !== 'number') return v;
  for (const [max, size] of scale) if (v <= max) return size;
  return v;
}
function snapRuns(scale, text, o) {
  if (o && o.fontSize) o.fontSize = snapSize(scale, o.fontSize);
  if (Array.isArray(text)) for (const r of text) if (r && r.options && r.options.fontSize) r.options.fontSize = snapSize(scale, r.options.fontSize);
}

function spectrumShapes(pres, scale) {
  const pageW = pres.presLayout.width / 914400;
  const RECT = pres.shapes.RECTANGLE, ROUND = pres.shapes.ROUNDED_RECTANGLE;
  const orig = pres.addSlide.bind(pres);
  pres.addSlide = (opts) => {
    const slide = orig(opts);
    const addText = slide.addText.bind(slide);
    slide.addText = (text, o = {}) => { o = { ...o }; snapRuns(scale, text, o); return addText(text, o); };
    const addTable = slide.addTable.bind(slide);
    slide.addTable = (rows, o = {}) => {
      o = { ...o }; snapRuns(scale, null, o);
      for (const row of rows) for (const cell of row) if (cell && cell.options) { if (cell.options.fontSize) cell.options.fontSize = snapSize(scale, cell.options.fontSize); if (Array.isArray(cell.text)) snapRuns(scale, cell.text, null); }
      return addTable(rows, o);
    };
    const add = slide.addShape.bind(slide);
    let last = null;
    slide.addShape = (type, o) => {
      o = { ...o };
      if (o.line && typeof o.line.width === 'number' && o.line.width > 0 && o.line.width < 1 && type !== pres.shapes.LINE) o.line = { ...o.line, width: HAIR };
      if (type === RECT || type === ROUND) {
        const fullBleed = o.x <= 0.01 && o.w >= pageW - 0.02;
        const isBar = type === RECT && o.h <= 0.07 && last && Math.abs(o.x - last.x) < 0.01 && Math.abs(o.y - last.y) < 0.01 && Math.abs(o.w - last.w) < 0.01;
        if (isBar) {
          add(ROUND, { x: o.x, y: o.y, w: o.w, h: BAR + R6, rectRadius: R6, fill: o.fill, line: { type: 'none' } });
          add(RECT, { x: o.x + 0.016, y: o.y + BAR, w: o.w - 0.032, h: R6, fill: last.fill, line: { type: 'none' } });
          return slide;
        }
        if (fullBleed || o.h <= 0.07) { last = null; return add(RECT, o); }
        last = { x: o.x, y: o.y, w: o.w, fill: o.fill && o.fill.color ? { color: o.fill.color } : { color: HEX.white } };
        return add(ROUND, { ...o, rectRadius: Math.min(R6, o.h / 2) });
      }
      last = null;
      return add(type, o);
    };
    return slide;
  };
}

// ---------- drawing helpers (all sizes in inches / points) ----------
function mkDraw(pres, I, { typeScale = null } = {}) {
  const C = scheme(pres);
  spectrumShapes(pres, typeScale);
  const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, valign: 'top', ...o });

  // Small icon, optionally on a 6px icon tile (the app's IconChip), never a circle.
  function ico(slide, name, x, y, s, color = HEX.navy, bg = null, pad = 0.22) {
    if (bg) {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: s, h: s, rectRadius: R6, fill: { color: bg }, line: { type: 'none' } });
      const inner = s * (1 - 2 * pad);
      slide.addImage({ data: I[name][color], x: x + s * pad, y: y + s * pad, w: inner, h: inner, altText: name + ' icon' });
    } else {
      slide.addImage({ data: I[name][color], x, y, w: s, h: s, altText: name + ' icon' });
    }
  }

  // Chip with text (6px corners, not a pill). Returns width used.
  function pill(slide, text, x, y, { h = 0.24, size = 7.5, fill = null, color = C.orangeText, line = null, bold = true, font = undefined, w = null, charSpacing = 0.5 } = {}) {
    const ww = w || Math.max(0.5, text.length * size * 0.0098 + 0.26);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: ww, h, rectRadius: R6,
      fill: fill ? { color: fill } : { type: 'none' },
      line: line ? { color: line, width: HAIR } : { type: 'none' },
    });
    T(slide, text, { x, y, w: ww, h, fontSize: size, bold, color, align: 'center', valign: 'middle', fontFace: font, charSpacing, fit: 'none' });
    return ww;
  }

  // Monospaced code badge, e.g. "U1".
  function code(slide, text, x, y, { fill = C.navy, color = C.white, size = 7, h = 0.2, w = null } = {}) {
    const ww = w || Math.max(0.32, text.length * size * 0.0092 + 0.14);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: ww, h, rectRadius: R6, fill: { color: fill }, line: { type: 'none' } });
    T(slide, text, { x, y, w: ww, h, fontSize: size, bold: true, color, fontFace: MONO, align: 'center', valign: 'middle' });
    return ww;
  }

  // "Coming soon" in the app's warning-banner colours (caution).
  function soon(slide, x, y, { size = 7, h = 0.19 } = {}) {
    if (!SOON) return 0;
    return pill(slide, 'COMING SOON', x, y, { h, size, fill: HEX.cautionSoft, color: HEX.caution, line: HEX.cautionLine, charSpacing: 0.6 });
  }

  // Card: raised surface, hairline edge, 3px top edge in its tone, optional code badge, icon, title, body.
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
      const sw = 'COMING SOON'.length * 7 * 0.0098 + 0.26;
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

// Family colours, used for a card's 3px top edge and its plain icon, the same on every page:
// set up the company = orange, keep it compliant = blue (info), board and money = green (positive),
// see and trust = navy, problems = red (danger).
const FAMILY = { setup: 'orange', comply: 'blue', money: 'green', trust: 'navy', problem: 'red' };

module.exports = { FAMILY, HEX, THEME, MONO, R6, SOON, LOGO, scheme, loadIcons, mkDraw };
