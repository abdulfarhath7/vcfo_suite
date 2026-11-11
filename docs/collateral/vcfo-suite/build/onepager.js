// VCFO Suite one-pager: one A4 portrait page (8.27 x 11.69 in). Nothing below 7pt.
const pptxgen = require('pptxgenjs');
const { HEX, THEME, MONO, SOON, LOGO, loadIcons, mkDraw } = require('./shared');
const { applyTheme } = require('./vendor/apply_theme.js');

const W = 8.27, H = 11.69, M = 0.5, CW = W - 2 * M;

async function main(out) {
  const I = await loadIcons();
  const pres = new pptxgen();
  pres.defineLayout({ name: 'A4P', width: W, height: H });
  pres.layout = 'A4P';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = 'VCFO Suite one-pager';
  pres.author = 'Steadfast Business Consulting';
  pres.company = 'Steadfast Business Consulting';
  const { C, T, ico, pill, code, soon } = mkDraw(pres, I);
  pres.defineSlideMaster({ title: 'One-pager', background: { color: C.white }, objects: [] });
  pres.addSection({ title: 'One-pager' });
  const s = pres.addSlide({ masterName: 'One-pager', sectionTitle: 'One-pager' });
  const label = (t, x, y, w = 3, color = C.orangeText) => T(s, t, { x, y, w, h: 0.18, fontSize: 7.5, bold: true, color, charSpacing: 1.4 });

  // 1 ─ Hero
  const HH = 3.5;
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: HH, fill: { color: C.navy }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.orange }, line: { type: 'none' } });
  s.addImage({ data: LOGO.onBlack, x: M, y: 0.32, w: 1.65, h: 1.65 / LOGO.ratio, altText: 'VCFO Suite by SBC logo' });
  T(s, 'app.sbctrack.in', { x: W - M - 2, y: 0.4, w: 2, h: 0.25, fontSize: 8.5, color: HEX.soft, align: 'right', fontFace: MONO });
  label('STEADFAST BUSINESS CONSULTING', M, 0.98, 4, C.orange);
  T(s, [{ text: 'Your company, incorporated and compliant — ', options: { color: C.white } }, { text: 'in one app.', options: { color: C.orange } }], { x: M, y: 1.2, w: 5.6, h: 0.92, fontSize: 25, bold: true, lineSpacingMultiple: 0.95 });
  T(s, 'VCFO Suite is the web app SBC, a CA and CMA-led firm, uses to set up your Indian company and run its whole compliance life, with you inside the same app.', { x: M, y: 2.14, w: 6.9, h: 0.42, fontSize: 9.5, color: HEX.soft, lineSpacingMultiple: 1.1 });
  const tiles = [['34', 'SPICe+ steps'], ['5', 'roles, one app'], ['1', 'record from day 0 to every filing'], ['2-in-1', 'platform + CA team']];
  const tw = (CW - 3 * 0.12) / 4;
  tiles.forEach(([big, t], i) => {
    const x = M + i * (tw + 0.12), y = 2.68;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: tw, h: 0.62, rectRadius: 0.06, fill: { color: C.navy2 }, line: { color: HEX.navy3, width: 0.75 } });
    const bw = big.length * 0.13 + 0.12;
    T(s, big, { x: x + 0.14, y, w: bw, h: 0.62, fontSize: 19, bold: true, color: C.orange, valign: 'middle' });
    T(s, t, { x: x + 0.14 + bw, y, w: tw - bw - 0.2, h: 0.62, fontSize: 7.8, color: C.white, valign: 'middle', lineSpacingMultiple: 1.0 });
  });

  // 2 ─ Problem | Answer
  const y2 = 3.72, lw = 3.35, rx = M + lw + 0.3, rw = CW - lw - 0.3;
  label('THE PROBLEM', M, y2, 3, C.red);
  const prob = [
    'Incorporation runs on email, WhatsApp and Excel; the client never knows the status.',
    'The same director data is typed into ten documents; one typo means a resubmission.',
    'After the COI, compliance lives in a diary or another tool, and due dates are missed.',
    'Licences, DSCs and registrations lapse silently; tax notices are answered late.',
  ];
  prob.forEach((t, i) => {
    const y = y2 + 0.25 + i * 0.35;
    s.addShape(pres.shapes.OVAL, { x: M, y: y + 0.07, w: 0.09, h: 0.09, fill: { color: C.red }, line: { type: 'none' } });
    T(s, t, { x: M + 0.18, y, w: lw - 0.18, h: 0.34, fontSize: 7.8, color: C.navy, lineSpacingMultiple: 1.05 });
  });
  label('THE VCFO ANSWER', rx, y2, 3);
  const steps = ['Set up', 'Document', 'Incorporate', 'Comply', 'Grow'];
  const sw = (rw - 4 * 0.09) / 5;
  steps.forEach((t, i) => {
    const x = rx + i * (sw + 0.09), y = y2 + 0.27;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: sw, h: 0.52, rectRadius: 0.06, fill: { color: i === 4 ? C.orange : C.navy }, line: { type: 'none' } });
    T(s, [{ text: String(i + 1), options: { fontSize: 7.5, fontFace: MONO, color: i === 4 ? C.navy : C.orange, breakLine: true } }, { text: t, options: { fontSize: 7.8, color: i === 4 ? C.navy : C.white } }], { x, y, w: sw, h: 0.52, bold: true, align: 'center', valign: 'middle', lineSpacingMultiple: 1.05 });
  });
  T(s, [
    { text: 'The platform ', options: { bold: true } }, { text: 'holds one record, generates the documents, keeps the calendar and chases people for you.', options: { breakLine: true } },
    { text: 'The SBC team ', options: { bold: true } }, { text: 'checks every step before you see it, files on your behalf and answers for the result.', options: {} },
  ], { x: rx, y: y2 + 0.92, w: rw, h: 0.75, fontSize: 7.8, color: C.navy, lineSpacingMultiple: 1.12, paraSpaceAfter: 3 });

  // 3 ─ What makes it different (the centre of the page)
  const y3 = 5.6;
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: y3 - 0.12, w: W, h: 2.5, fill: { color: C.off }, line: { type: 'none' } });
  label('WHAT MAKES IT DIFFERENT', M, y3, 4);
  T(s, 'Ten unique features; the six that matter most', { x: M + 3, y: y3, w: CW - 3, h: 0.18, fontSize: 7.5, color: C.muted, align: 'right' });
  const u = [
    ['U1', 'One app, day 0 to every filing', 'Incorporation and compliance on the same record. No hand-over, no re-entry.', C.orange, false],
    ['U2', 'Documents write themselves', 'MCA drafts from the checklist answers, one set per director, one ZIP.', C.orange, false],
    ['U3', 'Manager approval gate', 'Nothing reaches the client unchecked, and every action is logged.', C.orange, false],
    ['U5', 'The app chases for you', 'Request lists, T-60/T-30/T-7 expiry alerts, notice escalations, client health.', C.blue, true],
    ['U6', 'Ask VCFO', 'Answers from the client’s actual status and files, with citations.', C.blue, false],
    ['U7·U8', 'Board meetings and receivables', 'Notice to signed resolution; collections with bank matching and nine currencies.', C.green, true],
  ];
  const cw = (CW - 2 * 0.14) / 3, ch = 0.98;
  u.forEach(([c, t, b, bar, sn], i) => {
    const x = M + (i % 3) * (cw + 0.14), y = y3 + 0.26 + Math.floor(i / 3) * (ch + 0.1);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.white }, line: { color: HEX.line, width: 0.75 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.05, fill: { color: bar }, line: { type: 'none' } });
    code(s, c, x + 0.12, y + 0.16, { fill: C.navy, color: C.white, size: 7, h: 0.2, w: c.length > 3 ? 0.6 : 0.36 });
    if (sn && SOON) pill(s, 'COMING SOON', x + cw - 0.92, y + 0.16, { h: 0.18, size: 6, fill: HEX.cautionSoft, color: HEX.caution, w: 0.8, charSpacing: 0.4 });
    T(s, t, { x: x + 0.12, y: y + 0.4, w: cw - 0.24, h: 0.2, fontSize: 9, bold: true, color: C.navy });
    T(s, b, { x: x + 0.12, y: y + 0.6, w: cw - 0.24, h: 0.36, fontSize: 7.4, color: C.muted, lineSpacingMultiple: 1.05 });
  });

  // 4 ─ What's inside | What you receive
  const y4 = 8.1, iw = 4.75, rx2 = M + iw + 0.25, rw2 = CW - iw - 0.25;
  label('WHAT’S INSIDE', M, y4, 3);
  const inside = [
    ['Incorporation engine', '34 steps'],
    ['Document generator', 'per director'],
    ['Registrations', 'GST REG-01 and more'],
    ['Compliance calendar', 'GST to FEMA'],
    ['Board meetings', 'notice to minutes'],
    ['Receivables', 'bank match, forex'],
    ['Payroll and labour registers', ''],
    ['Proactive automation', 'chases for you'],
    ['Ask VCFO', 'AI with citations'],
    ['Client portal', 'works on a phone'],
    ['Firm cockpit', 'five roles, approvals'],
    ['Trust and security', 'vault, audit log'],
  ];
  const colW = (iw - 0.15) / 2;
  inside.forEach(([t, d], i) => {
    const col = Math.floor(i / 6), row = i % 6;
    const x = M + col * (colW + 0.15), y = y4 + 0.24 + row * 0.25;
    T(s, String(i + 1).padStart(2, '0'), { x, y, w: 0.24, h: 0.24, fontSize: 7, bold: true, color: C.orangeText, fontFace: MONO, valign: 'middle' });
    T(s, [{ text: t, options: { bold: true, color: C.navy } }, { text: d ? ' · ' + d : '', options: { color: C.muted } }], { x: x + 0.26, y, w: colW - 0.26, h: 0.24, fontSize: 7, valign: 'middle' });
  });
  label('WHAT YOU RECEIVE', rx2, y4, 3);
  const rec = ['An incorporated company with every MCA document', 'A live compliance calendar and filings register', 'Client portal logins for your directors and team', 'Board meeting and receivables workflows', 'SBC’s CA and CMA team, with SLA support'];
  rec.forEach((t, i) => {
    const y = y4 + 0.22 + i * 0.31;
    ico(s, 'check', rx2, y + 0.05, 0.2, HEX.green);
    T(s, t, { x: rx2 + 0.28, y, w: rw2 - 0.28, h: 0.3, fontSize: 7.4, color: C.navy, valign: 'middle' });
  });

  // 5 ─ Proven in the platform
  const y5 = 9.92;
  label('PROVEN IN THE PLATFORM', M, y5, 3);
  const chips = ['Per-director MCA drafts', 'Manager approval gate', 'Append-only audit log', 'Encrypted credentials vault', 'Two-step sign-in', 'AWS Mumbai', 'Email + WhatsApp + Outlook', 'Bank auto-matching', '9 currencies'];
  let cx = M, cy = y5 + 0.24;
  chips.forEach((t) => {
    const w = t.length * 7.2 * 0.0088 + 0.28;
    if (cx + w > M + CW + 0.01) { cx = M; cy += 0.3; }
    pill(s, t, cx, cy, { h: 0.24, size: 7.2, fill: C.navy, color: C.white, w, charSpacing: 0 });
    cx += w + 0.08;
  });

  // 6 ─ Footer CTA band
  const fy = 10.84;
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: fy, w: W, h: H - fy, fill: { color: C.navy }, line: { type: 'none' } });
  T(s, 'Let’s set up your company properly.', { x: M, y: fy + 0.12, w: 4.2, h: 0.3, fontSize: 13, bold: true, color: C.white, valign: 'middle' });
  T(s, 'Live demo  ·  Incorporation consultation  ·  Compliance health check', { x: M, y: fy + 0.45, w: 4.6, h: 0.22, fontSize: 8, color: C.orange, bold: true, valign: 'middle' });
  T(s, [{ text: 'info@sbcllp.in', options: { bold: true, breakLine: true } }, { text: 'app.sbctrack.in', options: { bold: true, breakLine: true } }, { text: 'Steadfast Business Consulting', options: { color: HEX.soft } }], { x: W - M - 2.4, y: fy + 0.1, w: 2.4, h: 0.62, fontSize: 8.5, color: C.white, align: 'right', valign: 'middle' });

  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log('wrote', out);
}

main(process.argv[2] || 'VCFO_Suite_One_Pager.pptx').catch((e) => { console.error(e); process.exit(1); });
