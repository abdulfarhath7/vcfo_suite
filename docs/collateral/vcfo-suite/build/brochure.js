// VCFO Suite brochure: 14 pages, A4 portrait (8.27 x 11.69 in).
const pptxgen = require('pptxgenjs');
const { HEX, THEME, MONO, SOON, LOGO, loadIcons, mkDraw } = require('./shared');
const { applyTheme } = require('./vendor/apply_theme.js');

const W = 8.27, H = 11.69, M = 0.6, CW = W - 2 * M;

async function main(out) {
  const I = await loadIcons();
  const pres = new pptxgen();
  pres.defineLayout({ name: 'A4P', width: W, height: H });
  pres.layout = 'A4P';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = 'VCFO Suite brochure';
  pres.author = 'Steadfast Business Consulting';
  pres.company = 'Steadfast Business Consulting';
  const D = mkDraw(pres, I);
  const { C, T, ico, pill, code, soon, card } = D;

  // ---------- layouts ----------
  pres.defineSlideMaster({
    title: 'VCFO page',
    background: { color: C.white },
    objects: [
      { placeholder: { options: { name: 'eyebrow', type: 'body', x: M, y: 0.6, w: CW, h: 0.22, fontSize: 8.5, bold: true, color: C.orangeText, margin: 0, valign: 'top', charSpacing: 1.5 }, text: '' } },
      { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.86, w: CW, h: 0.8, fontSize: 24, bold: true, color: C.navy, margin: 0, valign: 'top', lineSpacingMultiple: 0.95 }, text: '' } },
      { placeholder: { options: { name: 'lede', type: 'body', x: M, y: 1.72, w: 6.5, h: 0.62, fontSize: 10.5, color: C.muted, margin: 0, valign: 'top', lineSpacingMultiple: 1.12 }, text: '' } },
      { image: { data: LOGO.onWhite, x: M, y: H - 0.52, w: 0.22 * LOGO.ratio, h: 0.22, altText: 'VCFO Suite logo' } },
      { text: { text: 'Steadfast Business Consulting · app.sbctrack.in', options: { x: M + 0.95, y: H - 0.5, w: 4, h: 0.2, fontSize: 7.5, color: C.muted, margin: 0, valign: 'middle' } } },
    ],
    slideNumber: { x: W - M - 0.5, y: H - 0.5, w: 0.5, h: 0.2, fontSize: 8, color: C.muted, align: 'right', margin: 0 },
  });
  pres.defineSlideMaster({ title: 'VCFO cover', background: { color: C.navy }, objects: [] });

  const page = (section) => pres.addSlide({ masterName: 'VCFO page', sectionTitle: section });
  const head = (s, eyebrow, title, lede) => {
    s.addText(eyebrow, { placeholder: 'eyebrow', align: 'left' });
    s.addText(title, { placeholder: 'title', align: 'left', valign: 'top' });
    if (lede) s.addText(lede, { placeholder: 'lede', align: 'left', valign: 'top' });
  };
  // Tinted call-out strip at the foot of a page.
  const strip = (s, y, h, lead, text, { fill = C.tint, leadColor = C.brandText, color = C.navy, size = 9.5 } = {}) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: CW, h, rectRadius: 0.08, fill: { color: fill }, line: { type: 'none' } });
    T(s, [{ text: lead + '  ', options: { bold: true, color: leadColor } }, { text, options: { color } }], { x: M + 0.25, y, w: CW - 0.5, h, fontSize: size, valign: 'middle', lineSpacingMultiple: 1.12 });
  };
  // Navy hero call-out for a unique feature.
  const hero = (s, x, y, w, h, codeText, title, body, { soonTag = false, titleSize = w < 4 ? 10.5 : 11.5 } = {}) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: C.navy }, line: { type: 'none' } });
    T(s, codeText, { x: x + 0.2, y: y + 0.16, w: 0.9, h: 0.4, fontSize: 20, bold: true, color: C.orange, fontFace: MONO });
    if (soonTag) soon(s, x + w - 1.12, y + 0.18);
    T(s, title, { x: x + 1.05, y: y + 0.16, w: w - 1.25 - (soonTag && SOON ? 1.0 : 0), h: 0.4, fontSize: titleSize, bold: true, color: C.white, valign: 'middle' });
    T(s, body, { x: x + 1.05, y: y + 0.58, w: w - 1.25, h: h - 0.68, fontSize: 8.8, color: HEX.soft, lineSpacingMultiple: 1.12 });
  };
  const label = (s, text, x, y, w = 3, color = C.orangeText) => T(s, text, { x, y, w, h: 0.2, fontSize: 8, bold: true, color, charSpacing: 1.4 });

  // =============== 1. COVER ===============
  pres.addSection({ title: 'Cover' });
  {
    const s = pres.addSlide({ masterName: 'VCFO cover', sectionTitle: 'Cover' });
    s.addImage({ data: I.rule, x: 0, y: 0, w: W, h: 0.07, altText: 'Brand gradient rule' });
    s.addImage({ data: LOGO.onBlack, x: M, y: 0.75, w: 2.3, h: 2.3 / LOGO.ratio, altText: 'VCFO Suite by SBC logo' });
    pill(s, 'COMPLIANCE COCKPIT', M, 2.05, { h: 0.3, size: 8.5, line: HEX.orange, color: C.orange, charSpacing: 1.5, w: 1.95 });
    T(s, [
      { text: 'Your company, incorporated and compliant — ', options: { color: C.white } },
      { text: 'in one app.', options: { color: C.orange } },
    ], { x: M, y: 2.55, w: 6.7, h: 1.4, fontSize: 36, bold: true, lineSpacingMultiple: 0.95 });
    T(s, 'VCFO Suite is the web app SBC uses to set up your Indian company and then run its whole compliance life. You, your directors and our CA and CMA team work on the same record in the same app, from the first questionnaire to every annual filing.', { x: M, y: 4.1, w: 6.4, h: 0.95, fontSize: 11.5, color: HEX.soft, lineSpacingMultiple: 1.15 });

    const tiles = [
      ['34', 'SPICe+ steps, in MCA order'],
      ['5 roles', 'one app for firm and client'],
      ['1 record', 'incorporation → compliance, no hand-over'],
      ['2-in-1', 'platform + SBC’s CA/CMA team'],
    ];
    const tw = (CW - 3 * 0.15) / 4;
    tiles.forEach(([big, small], i) => {
      const x = M + i * (tw + 0.15), y = 5.35;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: tw, h: 1.2, rectRadius: 0.08, fill: { color: C.navy2 }, line: { color: C.navy3, width: 0.75 } });
      T(s, big, { x: x + 0.16, y: y + 0.17, w: tw - 0.3, h: 0.45, fontSize: 21, bold: true, color: C.white });
      T(s, small, { x: x + 0.16, y: y + 0.66, w: tw - 0.3, h: 0.45, fontSize: 8.5, color: HEX.soft, lineSpacingMultiple: 1.1 });
    });

    label(s, 'WHAT ONLY VCFO SUITE DOES', M, 7.0, 4, C.orange);
    T(s, 'Ten unique features · the first four below · all ten on page 13', { x: M + 3.0, y: 7.0, w: CW - 3.0, h: 0.2, fontSize: 8, color: HEX.soft, align: 'right' });
    const u = [
      ['U1', 'Incorporation to compliance', 'In one app, on the same record from the questionnaire to every filing. No hand-over, no re-entry.'],
      ['U2', 'Documents write themselves', 'MCA drafts are built from the checklist answers, one set per director, downloaded as one ZIP.'],
      ['U3', 'Manager approval gate', 'Nothing reaches the client unchecked, and every action is written to the audit log.'],
      ['U4', 'The client is inside the app', 'Your own portal on your own phone, instead of status buried in email threads.'],
    ];
    const uw = (CW - 0.15) / 2;
    u.forEach(([c, t, b], i) => {
      const x = M + (i % 2) * (uw + 0.15), y = 7.32 + Math.floor(i / 2) * 1.45;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: uw, h: 1.3, rectRadius: 0.08, fill: { color: C.navy2 }, line: { color: C.navy3, width: 0.75 } });
      code(s, c, x + 0.18, y + 0.2, { fill: C.orange, color: C.navy, size: 8, h: 0.24, w: 0.42 });
      T(s, t, { x: x + 0.72, y: y + 0.19, w: uw - 0.9, h: 0.28, fontSize: 11, bold: true, color: C.white, valign: 'middle' });
      T(s, b, { x: x + 0.72, y: y + 0.54, w: uw - 0.9, h: 0.68, fontSize: 9, color: HEX.soft, lineSpacingMultiple: 1.1 });
    });

    T(s, 'Powered by Steadfast Business Consulting', { x: M, y: 10.95, w: 4, h: 0.25, fontSize: 9.5, bold: true, color: C.white, valign: 'middle' });
    T(s, 'app.sbctrack.in  ·  info@sbcllp.in', { x: W - M - 3.5, y: 10.95, w: 3.5, h: 0.25, fontSize: 9, color: HEX.soft, align: 'right', valign: 'middle' });
  }

  // =============== 2. ABOUT ===============
  pres.addSection({ title: 'About' });
  {
    const s = page('About');
    head(s, 'ABOUT VCFO SUITE', 'Where software meets a CA firm’s practice',
      'VCFO Suite is the system SBC’s own CA and CMA team uses to incorporate companies and keep them compliant. We opened it up, so that clients work inside it with us.');
    T(s, 'Why we built it', { x: M, y: 2.55, w: 3.6, h: 0.3, fontSize: 12.5, bold: true, color: C.navy });
    T(s, [
      { text: 'For years we ran the same incorporation at client after client on email, WhatsApp and Excel. Directors called to ask for status. The same details were typed into ten documents. After the certificate of incorporation, the compliance calendar moved to a diary or to a different tool.', options: { breakLine: true, paraSpaceAfter: 7 } },
      { text: 'VCFO Suite is what we built to stop that. It holds the company’s record from the first questionnaire to every annual filing, and it lets the client and our team work on that record together, with a manager checking each step before the client sees it.', options: {} },
    ], { x: M, y: 2.92, w: 3.6, h: 2.35, fontSize: 9.5, color: C.navy, lineSpacingMultiple: 1.15 });

    const px = M + 3.85, pw = CW - 3.85;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px, y: 2.55, w: pw, h: 2.72, rectRadius: 0.08, fill: { color: C.navy }, line: { type: 'none' } });
    label(s, 'THE SHORT VERSION', px + 0.25, 2.78, 2.5, C.orange);
    T(s, 'One app. One record. One accountable team.', { x: px + 0.25, y: 3.05, w: pw - 0.5, h: 0.8, fontSize: 17, bold: true, color: C.white, lineSpacingMultiple: 0.98 });
    [['U1', 'The record that incorporates the company also runs its compliance.'], ['U4', 'The client works in the app, not on email threads.'], ['U10', 'SBC’s CA and CMA team is part of the engagement.']].forEach(([c, t], i) => {
      const y = 3.98 + i * 0.4;
      code(s, c, px + 0.25, y, { fill: C.orange, color: C.navy, w: 0.42 });
      T(s, t, { x: px + 0.78, y: y - 0.03, w: pw - 1.0, h: 0.34, fontSize: 8.5, color: HEX.soft, valign: 'middle' });
    });

    label(s, 'WHAT MAKES US DIFFERENT', M, 5.6, 4);
    const cards = [
      ['U10', 'Built by practitioners', 'Designed by the CA and CMA team that files for clients every month, around the order MCA, GST and the ROC actually work in.', 'briefcase'],
      ['U9', 'India-native', 'SPICe+, REG-01, GST, TDS, PF, ESI, ROC and FEMA events are built in from the start. Nothing is adapted from a foreign template.', 'flag'],
      ['U1', 'One app from day 0 to every filing', 'The questionnaire, checklist, documents, registrations and yearly calendar all sit on one company record.', 'route'],
      ['U4', 'Client inside the app', 'Directors see the journey, the next step, due dates and documents in their own portal, on a laptop or a phone.', 'phone'],
    ];
    const cw = (CW - 0.2) / 2;
    cards.forEach(([c, t, b, ic], i) => {
      card(s, { x: M + (i % 2) * (cw + 0.2), y: 5.9 + Math.floor(i / 2) * 1.75, w: cw, h: 1.58, codeText: c, title: t, body: b, iconName: ic, iconColor: HEX.orange, titleSize: 11, bodySize: 8.8 });
    });
    strip(s, 9.6, 0.95, 'Our premise.', 'A company should never have to ask its advisers “where are we?”. The answer should already be on its screen, checked by a manager and backed by a team that is accountable for it.');
  }

  // =============== 3. PROBLEM ===============
  pres.addSection({ title: 'Problem' });
  {
    const s = page('Problem');
    head(s, 'THE PROBLEM', 'Most incorporations and compliance calendars run on inboxes',
      'Founders, CFOs and foreign parents setting up Indian subsidiaries tell us the same six things. None of them is about effort. Each comes from work spread across tools that do not talk to each other.');
    const f = [
      ['F1', 'Status lives in someone’s inbox', 'Incorporation runs on email, WhatsApp and Excel, so the client never knows where things stand without calling.', 'mail'],
      ['F2', 'Same data, typed ten times', 'Each director’s details are typed again into every MCA document. One typo means a resubmission.', 'docs'],
      ['F3', 'Compliance moves to a diary', 'After the certificate of incorporation, the calendar lives in another tool or a diary, and due dates are missed.', 'calendar'],
      ['F4', 'Expiries arrive unannounced', 'Licences, DSCs and registrations lapse silently, and tax notices are answered late.', 'alert'],
      ['F5', 'Board papers are scattered', 'Notices, replies, minutes and signatures sit in several inboxes, and nobody holds the full set.', 'board'],
      ['F6', 'Collections chased by hand', 'Invoices are followed up one email at a time, and bank credits are matched in spreadsheets.', 'wallet'],
    ];
    const lw = 4.7, cw = (lw - 0.15) / 2, ch = 1.92;
    f.forEach(([c, t, b, ic], i) => {
      card(s, { x: M + (i % 2) * (cw + 0.15), y: 2.55 + Math.floor(i / 2) * (ch + 0.15), w: cw, h: ch, bar: C.red, codeText: c, codeFill: C.off, codeColor: C.red, title: t, titleLines: 2, body: b, iconName: ic, iconColor: HEX.red, titleSize: 10, bodySize: 8.5 });
    });
    const rx = M + lw + 0.2, rw = CW - lw - 0.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: 2.55, w: rw, h: 3.6, rectRadius: 0.08, fill: { color: C.navy }, line: { type: 'none' } });
    label(s, 'THE CONSEQUENCES', rx + 0.2, 2.75, rw - 0.4, C.orange);
    const cons = ['Late fees and penalties on missed ROC, GST and TDS dates.', 'Licences, DSCs and registrations that lapse unnoticed.', 'Directors embarrassed by notices, resubmissions and unsigned minutes.', 'Months lost between deciding to incorporate and being ready to trade.'];
    T(s, cons.map((t, i) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: i < cons.length - 1, paraSpaceAfter: 7 } })), { x: rx + 0.2, y: 3.08, w: rw - 0.35, h: 2.95, fontSize: 9.3, color: C.white, lineSpacingMultiple: 1.12 });

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: 6.3, w: rw, h: 2.29, rectRadius: 0.08, fill: { color: C.off }, line: { type: 'none' } });
    label(s, 'WHO THIS AFFECTS', rx + 0.2, 6.48, rw - 0.4);
    [['user', 'Founders and directors'], ['globe', 'Indian subsidiaries of foreign parents'], ['chart', 'CFOs and finance heads'], ['briefcase', 'CA and CS firms']].forEach(([ic, t], i) => {
      const y = 6.82 + i * 0.42;
      ico(s, ic, rx + 0.2, y, 0.26, HEX.orange);
      T(s, t, { x: rx + 0.56, y, w: rw - 0.7, h: 0.3, fontSize: 9, bold: true, color: C.navy, valign: 'middle' });
    });

    // Problem -> answer map
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 8.95, w: CW, h: 1.55, rectRadius: 0.08, fill: { color: C.tint }, line: { type: 'none' } });
    T(s, [{ text: 'Each finding maps to one VCFO Suite answer.', options: { bold: true, color: C.navy } }], { x: M + 0.25, y: 9.08, w: CW - 0.5, h: 0.28, fontSize: 10 });
    const map = [['F1', 'U4', 'Client portal'], ['F2', 'U2', 'Document generator'], ['F3', 'U1', 'Calendar on the same record'], ['F4', 'U5', 'Expiry and notice alerts'], ['F5', 'U7', 'Board meetings'], ['F6', 'U8', 'Receivables']];
    const mw = (CW - 0.5 - 0.2) / 3;
    map.forEach(([f1, u1, t], i) => {
      const x = M + 0.25 + (i % 3) * (mw + 0.1), y = 9.45 + Math.floor(i / 3) * 0.48;
      code(s, f1, x, y + 0.04, { fill: C.white, color: C.red, w: 0.36 });
      T(s, '→', { x: x + 0.38, y, w: 0.18, h: 0.28, fontSize: 9, color: C.muted, align: 'center', valign: 'middle' });
      code(s, u1, x + 0.58, y + 0.04, { fill: C.navy, color: C.white, w: 0.36 });
      T(s, t, { x: x + 1.0, y, w: mw - 1.0, h: 0.28, fontSize: 8.3, bold: true, color: C.navy, valign: 'middle' });
    });
  }

  // =============== 4. OVERVIEW ===============
  pres.addSection({ title: 'Product' });
  {
    const s = page('Product');
    head(s, 'PRODUCT OVERVIEW', 'One platform for the company’s whole life',
      'VCFO Suite follows a company from the first questionnaire to every annual filing. Each stage writes to the same record, so nothing is typed twice and nothing is handed over.');
    const steps = [['Onboard', 'questionnaire'], ['Checklist', '34 SPICe+ steps'], ['Documents', 'MCA drafts'], ['Incorporate', 'SPICe+ filing, COI'], ['Register', 'GST and others'], ['Comply', 'calendar, filings'], ['Grow', 'meetings, cash, payroll']];
    const sw = CW / 7, cy = 2.62, r = 0.46;
    s.addShape(pres.shapes.LINE, { x: M + sw / 2, y: cy + r / 2, w: CW - sw, h: 0, line: { color: HEX.line, width: 2 } });
    steps.forEach(([t, sub], i) => {
      const cx = M + i * sw + sw / 2 - r / 2;
      const last = i === steps.length - 1;
      s.addShape(pres.shapes.OVAL, { x: cx, y: cy, w: r, h: r, fill: { color: last ? C.orange : C.navy }, line: { color: C.white, width: 2 } });
      T(s, String(i + 1), { x: cx, y: cy, w: r, h: r, fontSize: 12, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: MONO });
      T(s, t, { x: M + i * sw, y: cy + r + 0.08, w: sw, h: 0.22, fontSize: 9, bold: true, color: C.navy, align: 'center' });
      T(s, sub, { x: M + i * sw, y: cy + r + 0.3, w: sw, h: 0.34, fontSize: 7.5, color: C.muted, align: 'center' });
    });

    const hdr = (t) => ({ text: t, options: { bold: true, color: C.muted, fill: { color: HEX.sunken }, fontSize: 8, charSpacing: 1 } });
    const rows = [
      ['Incorporation engine', false, 'Runs the 34-step SPICe+ checklist in MCA order.', 'Part A name intake; Part B capital, office, directors, subscribers, KYC and DSC; steps open in order; red marks on missing fields; auto-save.'],
      ['Document generator', false, 'Builds the MCA drafts from the checklist answers.', 'MOA, AOA, DIR-2, DIR-8, subscription sheets, declarations, letters, board resolution; one set per director; one ZIP.'],
      ['Registrations', false, 'Tracks each post-incorporation registration.', 'GST laid out like the portal’s REG-01 tabs; one tracker for every other registration.'],
      ['Compliance calendar', false, 'Keeps every company’s yearly calendar.', 'GST, TDS, PF, ESI, ROC/MCA and FEMA events; reminders; filings register with proof; Mark filed; six status words.'],
      ['Board meetings', false, 'Runs a meeting from notice to signed minutes.', '224-item agenda library; manager approval; Word notice, invite and Teams link; Yes/No replies; quorum; MoM signing.'],
      ['Receivables', true, 'Collects cash for the CFO.', 'Reminders before and after the due date; partner logins; camt bank import and auto-match; 9 currencies; ageing and forecast.'],
      ['Payroll and labour registers', true, 'Keeps payroll and statutory registers.', 'Salary updates; payroll summary; statutory labour registers generated per establishment.'],
      ['Proactive automation', true, 'Chases people so the team does not have to.', 'Request lists; T-60/T-30/T-7 expiry alerts; T-7/T-2 notice escalation; client health and SLA ladder; My day; weekly digest.'],
      ['Ask VCFO', false, 'Answers from the client’s own record.', 'Status answers; due dates and rules with citations; links to the right page; file drop of up to 50 files (coming soon).'],
    ];
    const body = rows.map(([m, isSoon, what, caps], i) => {
      const fill = { color: i % 2 ? HEX.white : HEX.off };
      const mod = [{ text: m, options: { bold: true, color: C.navy, breakLine: isSoon && SOON } }];
      if (isSoon && SOON) mod.push({ text: 'COMING SOON', options: { bold: true, color: C.amber, fontSize: 6.5, charSpacing: 0.6 } });
      return [
        { text: mod, options: { fill } },
        { text: what, options: { fill, color: C.navy } },
        { text: caps, options: { fill, color: C.muted } },
      ];
    });
    s.addTable([[hdr('MODULE'), hdr('WHAT IT DOES'), hdr('KEY CAPABILITIES')], ...body], {
      x: M, y: 3.85, w: CW, colW: [1.55, 2.05, 3.47], fontSize: 8, fontFace: THEME.bodyFontFace, valign: 'middle',
      margin: [0.05, 0.08, 0.05, 0.08], border: { type: 'solid', color: HEX.line, pt: 0.5 }, rowH: [0.28, ...rows.map(() => 0.55)],
    });
    strip(s, 9.55, 0.95, 'Five roles, one approval gate.', 'Super admin, admin, manager, project lead and client share one app. A lead’s draft stays hidden until a manager approves it, so the client only ever sees checked work.');
  }

  // =============== 5. INCORPORATION + DOCUMENTS ===============
  {
    const s = page('Product');
    head(s, 'INCORPORATION ENGINE · DOCUMENT GENERATOR', 'Answer once. The documents write themselves',
      'The incorporation runs as a 34-step SPICe+ checklist in the order MCA expects. Every answer is stored once and flows into each MCA draft, for each director.');
    const hw = (CW - 0.2) / 2;
    hero(s, M, 2.5, hw, 1.12, 'U1', 'One app, one record', 'The record built during incorporation becomes the company’s compliance record. Nobody re-enters it.');
    hero(s, M + hw + 0.2, 2.5, hw, 1.12, 'U2', 'Documents write themselves', 'MCA drafts are generated from the checklist answers, one set per director, and download as one ZIP.');

    // Left: checklist mock
    const lx = M, lw = 3.4, ly = 3.9;
    s.addShape(pres.shapes.RECTANGLE, { x: lx, y: ly, w: lw, h: 3.62, fill: { color: C.white }, line: { color: HEX.line, width: 0.75 } });
    T(s, 'SPICe+ checklist', { x: lx + 0.18, y: ly + 0.15, w: 2, h: 0.25, fontSize: 10.5, bold: true, color: C.navy });
    T(s, 'Illustrative view', { x: lx + lw - 1.4, y: ly + 0.17, w: 1.22, h: 0.22, fontSize: 7, color: C.muted, align: 'right', italic: true });
    const items = [
      ['Part A', 'Name intake', 'Done', HEX.green],
      ['Part B', 'Share capital', 'Done', HEX.green],
      ['Part B', 'Registered office', 'In progress', HEX.blue],
      ['Part B', 'Proposed directors', 'Waiting', HEX.teal],
      ['Part B', 'Subscribers', 'Not started', HEX.grey],
      ['Part B', 'KYC and DSC', 'Not started', HEX.grey],
    ];
    items.forEach(([part, t, st, col], i) => {
      const y = ly + 0.52 + i * 0.4;
      s.addShape(pres.shapes.LINE, { x: lx + 0.18, y: y - 0.04, w: lw - 0.36, h: 0, line: { color: HEX.line, width: 0.5 } });
      T(s, part, { x: lx + 0.18, y, w: 0.55, h: 0.3, fontSize: 7, color: C.muted, fontFace: MONO, valign: 'middle' });
      T(s, t, { x: lx + 0.75, y, w: 1.45, h: 0.3, fontSize: 8.8, bold: true, color: C.navy, valign: 'middle' });
      pill(s, st, lx + lw - 1.05, y + 0.04, { h: 0.22, size: 7, fill: col, color: C.white, w: 0.87, charSpacing: 0 });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: lx + 0.18, y: ly + 3.0, w: lw - 0.36, h: 0.45, rectRadius: 0.05, fill: { color: HEX.dangerSoft }, line: { type: 'none' } });
    ico(s, 'alert', lx + 0.28, ly + 3.09, 0.26, HEX.red);
    T(s, 'Red marks show the missing fields before anyone submits.', { x: lx + 0.62, y: ly + 3.0, w: lw - 0.85, h: 0.45, fontSize: 8, color: C.red, bold: true, valign: 'middle' });

    const feats = ['Part A covers the name; Part B covers capital, registered office, proposed directors, subscribers, and KYC with DSC.', 'Steps open in the right order, so nothing is filed before what it depends on.', 'The client and the project lead fill the steps directly, and every field saves as they type.'];
    T(s, feats.map((t, i) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: i < feats.length - 1, paraSpaceAfter: 5 } })), { x: lx, y: ly + 3.8, w: lw, h: 1.65, fontSize: 8.8, color: C.navy, lineSpacingMultiple: 1.12 });

    // Right: answers -> documents
    const rx = M + lw + 0.27, rw = CW - lw - 0.27;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: ly, w: rw, h: 0.62, rectRadius: 0.06, fill: { color: C.navy }, line: { type: 'none' } });
    ico(s, 'checklist', rx + 0.18, ly + 0.15, 0.32, HEX.orange);
    T(s, [{ text: 'Checklist answers', options: { bold: true, breakLine: true } }, { text: 'entered once, by the client or the lead', options: { color: HEX.soft, fontSize: 7.8 } }], { x: rx + 0.62, y: ly + 0.06, w: rw - 0.75, h: 0.5, fontSize: 9.5, color: C.white, valign: 'middle' });
    T(s, '▼', { x: rx, y: ly + 0.66, w: rw, h: 0.25, fontSize: 10, color: C.orange, align: 'center', valign: 'middle' });
    const docsList = ['MOA', 'AOA', 'DIR-2', 'DIR-8', 'Subscription sheet', 'Declarations', 'Authorisation letter', 'Acceptance letter', 'Board resolution'];
    const dw = (rw - 0.2) / 3;
    docsList.forEach((d, i) => {
      const x = rx + (i % 3) * (dw + 0.1), y = ly + 0.96 + Math.floor(i / 3) * 0.56;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: dw, h: 0.46, fill: { color: C.off }, line: { color: HEX.line, width: 0.5 } });
      ico(s, 'doc', x + 0.08, y + 0.11, 0.22, HEX.orange);
      T(s, d, { x: x + 0.33, y, w: dw - 0.37, h: 0.46, fontSize: d.length > 10 ? 7.2 : 8.3, bold: true, color: C.navy, valign: 'middle', fontFace: /^(MOA|AOA|DIR)/.test(d) ? MONO : undefined });
    });
    T(s, '▼', { x: rx, y: ly + 2.62, w: rw, h: 0.25, fontSize: 10, color: C.orange, align: 'center', valign: 'middle' });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: ly + 2.9, w: rw, h: 0.6, rectRadius: 0.06, fill: { color: C.tint }, line: { color: HEX.orange, width: 1 } });
    ico(s, 'zip', rx + 0.18, ly + 3.04, 0.32, HEX.orange);
    T(s, [{ text: 'Download all', options: { bold: true, breakLine: true } }, { text: 'one ZIP, one set of drafts per director', options: { color: C.muted, fontSize: 7.8 } }], { x: rx + 0.62, y: ly + 2.95, w: rw - 0.75, h: 0.5, fontSize: 9.5, color: C.navy, valign: 'middle' });
    T(s, [
      { text: 'The document pack ', options: { bold: true, color: C.navy } },
      { text: 'lists every draft with what is still blocking it, so nobody files an incomplete set. Per-director documents are produced for each proposed director automatically.', options: { color: C.navy } },
    ], { x: rx, y: ly + 3.8, w: rw, h: 1.0, fontSize: 8.8, lineSpacingMultiple: 1.12 });
    [0, 1, 2].forEach((k) => ico(s, 'user', rx + k * 0.36, ly + 4.85, 0.28, k === 0 ? HEX.orange : HEX.navy, null));
    T(s, 'Director 1 · Director 2 · Director 3 …', { x: rx + 1.15, y: ly + 4.85, w: rw - 1.15, h: 0.28, fontSize: 8, color: C.muted, valign: 'middle' });

    strip(s, 9.55, 0.95, 'Why it matters.', 'One typo used to mean one resubmission. Now a correction is made once, in the checklist, and every document for every director picks it up.');
  }

  // =============== 6. COMPLIANCE ===============
  {
    const s = page('Product');
    head(s, 'COMPLIANCE CALENDAR · REGISTRATIONS', 'Indian compliance, built in rather than adapted',
      'After the certificate of incorporation the company stays in the same app. Registrations start from the same record, and the yearly calendar is generated from the company’s own obligations.');
    const cw = (CW - 0.3) / 3;
    [
      ['Registrations', 'GST registration is laid out like the portal’s REG-01 tabs. Every other post-incorporation registration gets its own tracker.', 'stamp'],
      ['Yearly calendar', 'Each company gets its own calendar of GST, TDS, PF, ESI, ROC/MCA and FEMA events, statutory and non-statutory, with due-date reminders.', 'calendar'],
      ['Filings register', 'Every filing is recorded with its proof. “Mark filed” closes it, and the client sees the same entry in the portal.', 'checklist'],
    ].forEach(([t, b, ic], i) => card(s, { x: M + i * (cw + 0.15), y: 2.55, w: cw, h: 1.95, bar: C.navy, iconName: ic, iconColor: HEX.white, iconBg: HEX.navy, iconSize: 0.42, title: t, body: b, titleSize: 10.5, bodySize: 8.5 }));

    T(s, [{ text: 'One six-word status language, ', options: { bold: true, color: C.navy } }, { text: 'shared by the firm and the client on every screen.', options: { color: C.muted } }], { x: M, y: 4.72, w: CW, h: 0.25, fontSize: 9.5 });
    const words = [['Not started', HEX.grey], ['In progress', HEX.blue], ['Waiting', HEX.teal], ['Due soon', HEX.amber], ['Overdue', HEX.red], ['Done', HEX.green]];
    const pw = (CW - 5 * 0.1) / 6;
    words.forEach(([t, c], i) => pill(s, t, M + i * (pw + 0.1), 5.05, { h: 0.32, size: 8.5, fill: c, color: C.white, w: pw, charSpacing: 0 }));

    const hdr = (t) => ({ text: t, options: { bold: true, color: C.muted, fill: { color: HEX.sunken }, fontSize: 8, charSpacing: 1 } });
    const rows = [
      ['GST', 'Every GST-registered company', 'Monthly or quarterly returns, and the annual return'],
      ['TDS', 'Every company that deducts tax at source', 'Monthly deposits and quarterly returns'],
      ['PF', 'Establishments covered by the EPF Act', 'Monthly contributions and returns'],
      ['ESI', 'Establishments covered by the ESI Act', 'Monthly contributions and half-yearly returns'],
      ['ROC / MCA', 'Every company', 'Annual filings and event-based forms'],
      ['FEMA', 'Companies with foreign investment, such as Indian subsidiaries', 'Event-based reporting and annual returns'],
    ];
    const body = rows.map((r, i) => {
      const fill = { color: i % 2 ? HEX.white : HEX.off };
      return [
        { text: r[0], options: { fill, bold: true, color: C.navy, fontFace: MONO } },
        { text: r[1], options: { fill, color: C.navy } },
        { text: r[2], options: { fill, color: C.muted } },
        { text: 'Calendar · filings register · client portal', options: { fill, color: C.muted } },
      ];
    });
    s.addTable([[hdr('OBLIGATION'), hdr('WHO'), hdr('WHEN'), hdr('WHERE IT SHOWS')], ...body], {
      x: M, y: 5.65, w: CW, colW: [1.05, 2.25, 2.0, 1.77], fontSize: 8.3, fontFace: THEME.bodyFontFace, valign: 'middle',
      margin: [0.05, 0.08, 0.05, 0.08], border: { type: 'solid', color: HEX.line, pt: 0.5 }, rowH: [0.3, ...rows.map(() => 0.48)],
    });
    T(s, 'Exact due dates follow the current notifications for each law and are kept up to date by SBC’s team.', { x: M, y: 8.92, w: CW, h: 0.22, fontSize: 7.5, italic: true, color: C.muted });
    hero(s, M, 9.35, CW, 1.15, 'U9', 'India-native, not adapted', 'SPICe+, REG-01, GST, TDS, PF, ESI, ROC and FEMA are where the design starts. They are not add-ons bolted onto a generic task tool.');
  }

  // =============== 7. AUTOMATION + ASK VCFO ===============
  {
    const s = page('Product');
    head(s, 'PROACTIVE AUTOMATION · ASK VCFO', 'The app chases for you, and answers for you',
      'Most missed dates start as a missing file or a forgotten renewal. VCFO Suite follows up on its own, and Ask VCFO answers questions from the client’s actual record.');
    const lw = 3.45;
    code(s, 'U5', M, 2.55, { fill: C.orange, color: C.navy, size: 8, h: 0.26, w: 0.44 });
    T(s, 'The app chases for you', { x: M + 0.55, y: 2.55, w: 2.0, h: 0.26, fontSize: 11, bold: true, color: C.navy, valign: 'middle' });
    soon(s, M + lw - 1.0, 2.58);
    const auto = [
      ['Request lists', 'The client is asked for files by email, then WhatsApp, then a call task for the lead.', 'inbox'],
      ['Expiry alerts', 'Licences, DSCs and registrations alert at T-60, T-30 and T-7, and a renewal task opens itself.', 'clock'],
      ['Notice escalations', 'Tax notices are tracked with escalations at T-7 and T-2 before the reply is due.', 'alert'],
      ['Client health and SLA ladder', 'A nightly score per client. Slipping work moves from lead to manager to partner.', 'heart'],
    ];
    auto.forEach(([t, b, ic], i) => {
      const y = 2.98 + i * 1.5;
      s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: lw, h: 1.36, fill: { color: C.white }, line: { color: HEX.line, width: 0.75 } });
      ico(s, ic, M + 0.16, y + 0.2, 0.46, HEX.white, HEX.orange);
      T(s, t, { x: M + 0.76, y: y + 0.18, w: lw - 0.9, h: 0.25, fontSize: 10.3, bold: true, color: C.navy });
      T(s, b, { x: M + 0.76, y: y + 0.48, w: lw - 0.9, h: 0.8, fontSize: 8.8, color: C.muted, lineSpacingMultiple: 1.1 });
    });
    T(s, 'Every staff member also gets a “My day” card and email, and the firm gets a weekly digest.', { x: M, y: 9.0, w: lw, h: 0.42, fontSize: 8.4, italic: true, color: C.navy });

    const rx = M + lw + 0.22, rw = CW - lw - 0.22, ry = 2.55, rh = 6.95;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: ry, w: rw, h: rh, rectRadius: 0.1, fill: { color: C.navy }, line: { type: 'none' } });
    ico(s, 'bot', rx + 0.2, ry + 0.2, 0.42, HEX.navy, HEX.orange);
    T(s, 'Ask VCFO', { x: rx + 0.72, y: ry + 0.2, w: 1.5, h: 0.42, fontSize: 13, bold: true, color: C.white, valign: 'middle' });
    code(s, 'U6', rx + rw - 0.62, ry + 0.3, { fill: C.orange, color: C.navy, size: 8, h: 0.24, w: 0.42 });
    T(s, 'An AI assistant inside the app that knows the client’s actual status and files. It links to the right page, and cites the rule when it explains a due date.', { x: rx + 0.2, y: ry + 0.75, w: rw - 0.4, h: 0.72, fontSize: 8.6, color: HEX.soft, lineSpacingMultiple: 1.12 });
    const bub = (y, q, isQ) => {
      const bw = rw - 0.8;
      const x = isQ ? rx + rw - 0.2 - bw : rx + 0.2;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: bw, h: 0.52, rectRadius: 0.08, fill: { color: isQ ? C.orange : C.navy2 }, line: isQ ? { type: 'none' } : { color: HEX.navy3, width: 0.75 } });
      T(s, q, { x: x + 0.14, y, w: bw - 0.28, h: 0.52, fontSize: 8.2, color: isQ ? C.navy : C.white, bold: isQ, valign: 'middle' });
    };
    bub(ry + 1.55, '“Where is my incorporation?”', true);
    bub(ry + 2.13, 'Reads the live checklist: which step is open, what is missing, and a link to that step.', false);
    bub(ry + 2.75, '“Why is this return due on that date?”', true);
    bub(ry + 3.33, 'Explains the due date and the rule behind it, with a citation.', false);

    s.addShape(pres.shapes.LINE, { x: rx + 0.2, y: ry + 4.05, w: rw - 0.4, h: 0, line: { color: HEX.navy3, width: 0.75 } });
    T(s, 'Drop files, get a review card', { x: rx + 0.2, y: ry + 4.17, w: 2.2, h: 0.25, fontSize: 9.5, bold: true, color: C.white });
    soon(s, rx + rw - 1.12, ry + 4.2);
    const flow = [['upload', 'Staff drop files, folders or ZIPs, up to 50 files at once.'], ['layers', 'Ask VCFO sorts them into one review card per client.'], ['pen', 'It proposes the form fill from what it read.'], ['check', 'A person always approves before anything is saved.']];
    flow.forEach(([ic, t], i) => {
      const y = ry + 4.55 + i * 0.58;
      ico(s, ic, rx + 0.2, y + 0.03, 0.38, HEX.orange, HEX.navy2);
      T(s, t, { x: rx + 0.7, y, w: rw - 0.9, h: 0.44, fontSize: 8.3, color: C.white, valign: 'middle' });
    });
    strip(s, 9.75, 0.75, 'The rule we kept.', 'Automation suggests and reminds. A person on SBC’s team always approves.');
  }

  // =============== 8. BOARD MEETINGS ===============
  {
    const s = page('Product');
    head(s, 'BOARD MEETINGS', 'Board meetings, end to end, in one place',
      'From the notice to the signed resolution, every board meeting runs through one loop. Directors take part from their email; the full record stays in the app.');
    const steps = [
      ['Draft', 'The lead drafts the notice from a 224-item agenda library.', 'pen'],
      ['Approve', 'A manager approves the notice before it is sent.', 'badge'],
      ['Send', 'Email with the Word notice, calendar invite and Teams link.', 'send'],
      ['Reply', 'Directors reply Yes or No from the email, without logging in.', 'vote'],
      ['Quorum', 'The app forecasts quorum from the replies before the day.', 'users'],
      ['Meet', 'The meeting runs on the Teams link from the invite.', 'video'],
      ['Sign the minutes', 'The MoM is uploaded and goes round the signing loop.', 'pen'],
      ['Carry forward', 'Resolutions are carried into the next notice.', 'repeat'],
    ];
    const bw = (CW - 3 * 0.2) / 4, bh = 1.75;
    steps.forEach(([t, b, ic], i) => {
      const row = Math.floor(i / 4), col = i % 4;
      const x = M + col * (bw + 0.2), y = 2.55 + row * (bh + 0.3);
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: bw, h: bh, fill: { color: row === 0 ? C.white : C.off }, line: { color: HEX.line, width: 0.75 } });
      s.addShape(pres.shapes.OVAL, { x: x + 0.14, y: y + 0.14, w: 0.36, h: 0.36, fill: { color: i === 3 ? C.orange : C.navy }, line: { type: 'none' } });
      T(s, String(i + 1), { x: x + 0.14, y: y + 0.14, w: 0.36, h: 0.36, fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: MONO });
      ico(s, ic, x + bw - 0.42, y + 0.18, 0.28, HEX.orange);
      T(s, t, { x: x + 0.14, y: y + 0.6, w: bw - 0.28, h: 0.25, fontSize: 9.8, bold: true, color: C.navy });
      T(s, b, { x: x + 0.14, y: y + 0.88, w: bw - 0.28, h: 0.8, fontSize: 8.3, color: C.muted, lineSpacingMultiple: 1.1 });
      if (col < 3) T(s, '›', { x: x + bw, y: y + bh / 2 - 0.15, w: 0.2, h: 0.3, fontSize: 14, bold: true, color: C.orange, align: 'center', valign: 'middle' });
    });

    // Email mock
    const ey = 6.75, ew = 3.7;
    s.addShape(pres.shapes.RECTANGLE, { x: M, y: ey, w: ew, h: 2.55, fill: { color: C.white }, line: { color: HEX.line, width: 0.75 } });
    s.addShape(pres.shapes.RECTANGLE, { x: M, y: ey, w: ew, h: 0.42, fill: { color: C.off }, line: { type: 'none' } });
    ico(s, 'mail', M + 0.15, ey + 0.09, 0.24, HEX.navy);
    T(s, 'Notice of board meeting', { x: M + 0.48, y: ey, w: ew - 1.6, h: 0.42, fontSize: 9, bold: true, color: C.navy, valign: 'middle' });
    T(s, 'Illustrative', { x: M + ew - 1.1, y: ey, w: 0.95, h: 0.42, fontSize: 7, italic: true, color: C.muted, align: 'right', valign: 'middle' });
    const att = [['doc', 'Notice and agenda (.docx)'], ['calendar', 'Calendar invite'], ['video', 'Teams meeting link']];
    att.forEach(([ic, t], i) => {
      const y = ey + 0.56 + i * 0.36;
      ico(s, ic, M + 0.18, y + 0.02, 0.22, HEX.orange);
      T(s, t, { x: M + 0.5, y, w: ew - 0.7, h: 0.26, fontSize: 8.5, color: C.navy, valign: 'middle' });
    });
    T(s, 'Will you attend?', { x: M + 0.18, y: ey + 1.66, w: 2, h: 0.24, fontSize: 8.5, bold: true, color: C.navy });
    pill(s, 'Yes', M + 0.18, ey + 1.98, { h: 0.34, size: 9, fill: HEX.green, color: C.white, w: 0.95, charSpacing: 0 });
    pill(s, 'No', M + 1.25, ey + 1.98, { h: 0.34, size: 9, fill: C.white, line: HEX.line, color: C.navy, w: 0.95, charSpacing: 0 });
    T(s, 'no login needed', { x: M + 2.3, y: ey + 1.98, w: 1.3, h: 0.34, fontSize: 7.5, italic: true, color: C.muted, valign: 'middle' });

    const fx = M + ew + 0.25, fw = CW - ew - 0.25;
    [['224', 'agenda items in the library'], ['1 loop', 'notice, replies, minutes, signatures, resolutions'], ['0', 'logins needed for a director to reply']].forEach(([big, t], i) => {
      const y = ey + i * 0.88;
      s.addShape(pres.shapes.RECTANGLE, { x: fx, y, w: fw, h: 0.78, fill: { color: C.off }, line: { type: 'none' } });
      T(s, big, { x: fx + 0.18, y, w: 1.1, h: 0.78, fontSize: 20, bold: true, color: C.orange, valign: 'middle' });
      T(s, t, { x: fx + 1.3, y, w: fw - 1.45, h: 0.78, fontSize: 8.6, color: C.navy, valign: 'middle' });
    });
    hero(s, M, 9.55, CW, 0.95, 'U7', 'Board meetings end to end', 'Notice, Teams, director Yes/No, minutes and signed resolutions, in one loop that the manager approves and the audit log records.');
  }

  // =============== 9. RECEIVABLES + PAYROLL ===============
  {
    const s = page('Product');
    head(s, 'RECEIVABLES · PAYROLL AND LABOUR REGISTERS', 'Cash collection for the CFO, not just compliance',
      'Each manager keeps an invoice sheet. VCFO Suite reminds the customer on a fixed schedule, matches the bank credit when it lands and reports what is still out.');
    soon(s, W - M - 1.0, 0.6);
    // Reminder timeline
    const ty = 2.62;
    s.addShape(pres.shapes.RECTANGLE, { x: M, y: ty, w: CW, h: 1.38, fill: { color: C.off }, line: { type: 'none' } });
    T(s, 'Automatic reminders on every invoice', { x: M + 0.2, y: ty + 0.12, w: 4, h: 0.24, fontSize: 9.5, bold: true, color: C.navy });
    const marks = [['5 days before', HEX.blue], ['3 days before', HEX.blue], ['On the due date', HEX.amber], ['Every day after', HEX.red]];
    const lx0 = M + 0.6, lx1 = M + CW - 0.6, ly = ty + 0.72;
    s.addShape(pres.shapes.LINE, { x: lx0, y: ly, w: lx1 - lx0, h: 0, line: { color: HEX.line, width: 2.5 } });
    marks.forEach(([t, c], i) => {
      const cx = lx0 + i * (lx1 - lx0) / 3;
      ico(s, 'bell', cx - 0.18, ly - 0.18, 0.36, HEX.white, c);
      T(s, t, { x: cx - 0.8, y: ly + 0.24, w: 1.6, h: 0.25, fontSize: 8.5, bold: true, color: C.navy, align: 'center' });
    });

    const cw = (CW - 0.2) / 2, ch = 1.62;
    const cards = [
      ['Partner logins and promise-to-pay', 'The customer’s finance contact gets a login, sees open invoices and records a promise-to-pay date.', 'handshake', null],
      ['Bank import and auto-matching', 'Import ISO 20022 camt bank statements. Credits match to invoices, with tolerance for TDS and bank charges.', 'bank', null],
      ['Forex desk in nine currencies', 'Raise invoices in nine foreign currencies and track each one through the forex desk.', 'globe', '9'],
      ['Ageing and cash forecast', 'Ageing reports and a cash forecast built from due dates and the promises customers have made.', 'chart', null],
    ];
    cards.forEach(([t, b, ic, big], i) => {
      const x = M + (i % 2) * (cw + 0.2), y = 4.2 + Math.floor(i / 2) * (ch + 0.18);
      card(s, { x, y, w: cw, h: ch, bar: C.green, iconName: ic, iconColor: HEX.green, title: t, body: b, titleSize: 10, bodySize: 8.5 });
      if (big) T(s, big, { x: x + cw - 0.75, y: y + 0.1, w: 0.6, h: 0.5, fontSize: 24, bold: true, color: C.orange, align: 'right' });
    });

    const py = 7.85;
    s.addShape(pres.shapes.RECTANGLE, { x: M, y: py, w: CW, h: 1.5, fill: { color: C.white }, line: { color: HEX.line, width: 0.75 } });
    s.addShape(pres.shapes.RECTANGLE, { x: M, y: py, w: CW, h: 0.06, fill: { color: C.navy }, line: { type: 'none' } });
    T(s, 'Payroll and labour registers', { x: M + 0.18, y: py + 0.18, w: 3.5, h: 0.26, fontSize: 10.5, bold: true, color: C.navy });
    soon(s, W - M - 1.12, py + 0.2);
    [['rupee', 'Salary updates', 'Record changes as they happen.'], ['table', 'Payroll summary', 'One view of the month’s payroll.'], ['history', 'Labour registers', 'Statutory registers per establishment.']].forEach(([ic, t, b], i) => {
      const x = M + 0.18 + i * ((CW - 0.36) / 3);
      ico(s, ic, x, py + 0.6, 0.38, HEX.navy, HEX.off);
      T(s, t, { x: x + 0.48, y: py + 0.56, w: 1.75, h: 0.24, fontSize: 9, bold: true, color: C.navy });
      T(s, b, { x: x + 0.48, y: py + 0.8, w: 1.75, h: 0.5, fontSize: 8, color: C.muted });
    });
    hero(s, M, 9.55, CW, 0.95, 'U8', 'Receivables with bank matching and forex', 'The same app that keeps the company compliant also brings the cash in, which is why a CFO uses it and not only the company secretary.');
  }

  // =============== 10. PORTAL + COCKPIT ===============
  {
    const s = page('Product');
    head(s, 'CLIENT PORTAL · FIRM COCKPIT', 'What the client sees. What the firm sees',
      'Both sides work on the same record. The client gets a calm portal with only approved work; the firm gets the cockpit that checks the work before it is shown.');
    const cw = (CW - 0.2) / 2, y0 = 2.55, h0 = 3.85;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: y0, w: cw, h: h0, rectRadius: 0.08, fill: { color: C.off }, line: { type: 'none' } });
    code(s, 'U4', M + 0.2, y0 + 0.22, { fill: C.orange, color: C.navy, size: 8, h: 0.24, w: 0.42 });
    T(s, 'What the client sees', { x: M + 0.72, y: y0 + 0.2, w: cw - 0.9, h: 0.28, fontSize: 11.5, bold: true, color: C.navy, valign: 'middle' });
    const cl = [['map', 'Journey map, company snapshot and the next step'], ['calendar', 'Due dates, in the six status words'], ['folder', 'Documents explorer with every approved draft'], ['message', 'Requests, messages and the SBC team'], ['history', 'Audit log of what was done and by whom'], ['lock', 'Encrypted credentials vault'], ['phone', 'Works on a phone']];
    cl.forEach(([ic, t], i) => {
      const y = y0 + 0.66 + i * 0.44;
      ico(s, ic, M + 0.2, y, 0.3, HEX.orange, HEX.white);
      T(s, t, { x: M + 0.62, y, w: cw - 0.8, h: 0.3, fontSize: 8.8, color: C.navy, valign: 'middle' });
    });
    const rx = M + cw + 0.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: y0, w: cw, h: h0, rectRadius: 0.08, fill: { color: C.navy }, line: { type: 'none' } });
    code(s, 'U3', rx + 0.2, y0 + 0.22, { fill: C.orange, color: C.navy, size: 8, h: 0.24, w: 0.42 });
    T(s, 'What the firm sees', { x: rx + 0.72, y: y0 + 0.2, w: cw - 0.9, h: 0.28, fontSize: 11.5, bold: true, color: C.white, valign: 'middle' });
    const fl = [['shield', 'Manager approval gate: drafts stay hidden until approved', false], ['inbox', 'Approvals inbox across every client', false], ['sun', 'My day card and email for each staff member', true], ['chart', 'Analytics and practice reports', false], ['gauge', 'Team load and risks', false], ['mail', 'Outlook mail inside the app', false]];
    fl.forEach(([ic, t, sn], i) => {
      const y = y0 + 0.66 + i * 0.5;
      ico(s, ic, rx + 0.2, y, 0.3, HEX.orange, HEX.navy2);
      T(s, t, { x: rx + 0.62, y: y - 0.04, w: cw - 0.8 - (sn && SOON ? 0.95 : 0), h: 0.38, fontSize: 8.8, color: C.white, valign: 'middle' });
      if (sn) soon(s, rx + cw - 1.08, y + 0.05);
    });

    T(s, 'One app, five roles', { x: M, y: 6.65, w: 3, h: 0.28, fontSize: 11.5, bold: true, color: C.navy });
    const hdr = (t) => ({ text: t, options: { bold: true, color: C.muted, fill: { color: HEX.sunken }, fontSize: 7.8, align: 'center' } });
    const Y = '✓', N = '–';
    const rows = [
      ['Firm users and settings', Y, Y, N, N, N],
      ['Clients they can see', 'All', 'All', 'Team', 'Assigned', 'Own company'],
      ['Fill the checklist and forms', Y, Y, Y, Y, Y],
      ['Approve work before the client sees it', Y, Y, Y, N, N],
      ['Analytics, team load and risks', Y, Y, Y, N, N],
      ['Approved documents, due dates, messages', Y, Y, Y, Y, Y],
    ];
    const body = rows.map((r, i) => r.map((c, j) => ({ text: c, options: { fill: { color: i % 2 ? HEX.white : HEX.off }, color: j === 0 ? C.navy : (c === Y ? C.green : C.navy), bold: j === 0 || c === Y, align: j === 0 ? 'left' : 'center', fontSize: c === Y ? 10 : 8 } })));
    s.addTable([[{ text: 'FEATURE', options: { bold: true, color: C.muted, fill: { color: HEX.sunken }, fontSize: 7.8 } }, hdr('SUPER ADMIN'), hdr('ADMIN'), hdr('MANAGER'), hdr('LEAD'), hdr('CLIENT')], ...body], {
      x: M, y: 7.02, w: CW, colW: [2.42, 0.93, 0.93, 0.93, 0.93, 0.93], fontSize: 8, fontFace: THEME.bodyFontFace, valign: 'middle',
      margin: [0.04, 0.08, 0.04, 0.08], border: { type: 'solid', color: HEX.line, pt: 0.5 }, rowH: [0.3, ...rows.map(() => 0.34)],
    });
    T(s, 'Simplified view. The platform applies the exact rules to every query, so a client never sees another client’s data.', { x: M, y: 9.42, w: CW, h: 0.22, fontSize: 7.5, italic: true, color: C.muted });
    strip(s, 9.8, 0.72, 'U3 · Nothing reaches the client unchecked.', 'Every draft passes a manager first, and every action is logged.', { size: 9.2 });
  }

  // =============== 11. TRUST ===============
  pres.addSection({ title: 'Trust' });
  {
    const s = page('Trust');
    head(s, 'TRUST AND SECURITY', 'Built so a client’s data stays the client’s',
      'Compliance work carries PAN, Aadhaar, DSC and bank details. VCFO Suite treats that data as the most sensitive thing in the app, at every layer.');
    const cards = [
      ['Role scoping on every query', 'Each database query is scoped to the user’s role and clients. A client never sees another client’s data.', 'shield'],
      ['Append-only audit log', 'Every action is written to a log that cannot be edited, with who did it and when.', 'history'],
      ['Encrypted credentials vault', 'Portal logins and passwords the firm holds for a client are stored encrypted.', 'lock'],
      ['Two-step sign-in', 'TOTP two-step sign-in and session control, so a lost device can be signed out.', 'key'],
      ['AWS Mumbai', 'Hosted in AWS ap-south-1, with the database on RDS and documents on S3.', 'server'],
      ['Email is the record', 'Email is the system of record. WhatsApp is an extra nudge and never blocks an email.', 'mail'],
    ];
    const cw = (CW - 0.3) / 3, ch = 1.85;
    cards.forEach(([t, b, ic], i) => card(s, { x: M + (i % 3) * (cw + 0.15), y: 2.55 + Math.floor(i / 3) * (ch + 0.15), w: cw, h: ch, bar: C.navy, iconName: ic, iconColor: HEX.white, iconBg: HEX.navy, iconSize: 0.42, title: t, titleLines: 2, body: b, titleSize: 9.8, bodySize: 8.3 }));

    // Data path
    const dy = 6.7;
    T(s, 'Where the data lives', { x: M, y: dy, w: 3, h: 0.26, fontSize: 11, bold: true, color: C.navy });
    const nodes = [['user', 'Client, director or staff', 'browser or phone'], ['globe', 'app.sbctrack.in', 'role-scoped app'], ['database', 'Amazon RDS', 'company records'], ['folder', 'Amazon S3', 'documents and files']];
    const nw = (CW - 3 * 0.3) / 4;
    nodes.forEach(([ic, t, sub], i) => {
      const x = M + i * (nw + 0.3), y = dy + 0.4;
      const inAws = i >= 2;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: nw, h: 1.05, rectRadius: 0.06, fill: { color: inAws ? C.navy : C.off }, line: { type: 'none' } });
      ico(s, ic, x + 0.14, y + 0.14, 0.32, inAws ? HEX.orange : HEX.navy);
      T(s, t, { x: x + 0.14, y: y + 0.52, w: nw - 0.2, h: 0.24, fontSize: 8.8, bold: true, color: inAws ? C.white : C.navy, fontFace: i === 1 ? MONO : undefined });
      T(s, sub, { x: x + 0.14, y: y + 0.76, w: nw - 0.2, h: 0.22, fontSize: 7.8, color: inAws ? HEX.soft : C.muted });
      if (i < 3) T(s, '→', { x: x + nw, y: y + 0.38, w: 0.3, h: 0.3, fontSize: 12, bold: true, color: C.orange, align: 'center', valign: 'middle' });
    });
    T(s, 'AWS Mumbai · ap-south-1', { x: M + 2 * (nw + 0.3), y: dy + 1.5, w: 2 * nw + 0.3, h: 0.22, fontSize: 7.8, bold: true, color: C.navy, align: 'center', fontFace: MONO });

    const sy = 8.45;
    T(s, 'Suitable for', { x: M, y: sy, w: 3, h: 0.26, fontSize: 11, bold: true, color: C.navy });
    const suit = ['New Indian private limited companies and their directors', 'Indian subsidiaries of foreign parent companies', 'CFOs and finance heads who need one view of compliance and cash', 'CA and CS firms who want their clients inside the work'];
    const sw = (CW - 0.15) / 2;
    suit.forEach((t, i) => {
      const x = M + (i % 2) * (sw + 0.15), y = sy + 0.38 + Math.floor(i / 2) * 0.5;
      ico(s, 'check', x, y + 0.04, 0.26, HEX.green);
      T(s, t, { x: x + 0.36, y, w: sw - 0.4, h: 0.4, fontSize: 8.8, color: C.navy, valign: 'middle' });
    });
    strip(s, 10.0, 0.62, 'The same rules for everyone.', 'Staff see only the clients they work on, and every change they make is in the audit log.');
  }

  // =============== 12. ONBOARDING ===============
  pres.addSection({ title: 'Onboarding' });
  {
    const s = page('Onboarding');
    head(s, 'ONBOARDING', 'From first call to live in [SBC to confirm] days',
      'SBC sets up the project, the client answers the questionnaire, and the team takes the company through filing to a live compliance calendar, all in the same app.');
    const ph = [
      ['Discovery and project setup', ['First call on structure and timelines.', 'Project created with its lead and manager.', 'Client portal logins issued.'], 'users'],
      ['Questionnaire and checklist', ['Client answers the questionnaire.', 'The 34-step checklist opens in order.', 'Red marks show what is missing.'], 'checklist'],
      ['Documents, filing and COI', ['MCA drafts generated per director.', 'Manager approves, client signs.', 'SPICe+ filed; COI received.'], 'doc'],
      ['Registrations and calendar live', ['GST and other registrations tracked.', 'Yearly compliance calendar generated.', 'Reminders and filings register live.'], 'calendar'],
    ];
    const pw = (CW - 3 * 0.15) / 4, py = 2.6, phh = 3.6;
    ph.forEach(([t, list, ic], i) => {
      const x = M + i * (pw + 0.15);
      s.addShape(pres.shapes.RECTANGLE, { x, y: py, w: pw, h: phh, fill: { color: i === 3 ? C.navy : C.white }, line: i === 3 ? { type: 'none' } : { color: HEX.line, width: 0.75 } });
      T(s, 'PHASE ' + (i + 1), { x: x + 0.15, y: py + 0.18, w: pw - 0.3, h: 0.2, fontSize: 7.5, bold: true, color: i === 3 ? C.orange : C.orangeText, charSpacing: 1.2 });
      ico(s, ic, x + pw - 0.5, py + 0.14, 0.32, i === 3 ? HEX.orange : HEX.navy);
      T(s, t, { x: x + 0.15, y: py + 0.55, w: pw - 0.3, h: 0.62, fontSize: 10, bold: true, color: i === 3 ? C.white : C.navy, lineSpacingMultiple: 1.0 });
      T(s, list.map((l, k) => ({ text: l, options: { bullet: { indent: 8 }, breakLine: k < list.length - 1, paraSpaceAfter: 5 } })), { x: x + 0.15, y: py + 1.28, w: pw - 0.25, h: 1.7, fontSize: 8.3, color: i === 3 ? HEX.soft : C.muted, lineSpacingMultiple: 1.1 });
      T(s, '[SBC to confirm] weeks', { x: x + 0.15, y: py + phh - 0.42, w: pw - 0.3, h: 0.25, fontSize: 7, bold: true, color: i === 3 ? C.orange : C.orangeText, fontFace: MONO });
    });
    const tiles = [['34', 'checklist steps tracked on screen from day one'], ['5', 'roles set up at project start, including the client'], ['[SBC to confirm]', 'days from first call to certificate of incorporation']];
    const tw = (CW - 0.3) / 3;
    tiles.forEach(([big, t], i) => {
      const x = M + i * (tw + 0.15), y = 6.45;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: tw, h: 1.25, fill: { color: C.off }, line: { type: 'none' } });
      T(s, big, { x: x + 0.18, y: y + 0.12, w: tw - 0.36, h: 0.55, fontSize: big.length > 4 ? 13 : 26, bold: true, color: C.orange, valign: 'middle' });
      T(s, t, { x: x + 0.18, y: y + 0.7, w: tw - 0.36, h: 0.45, fontSize: 8.5, color: C.navy });
    });
    // What we need from you
    T(s, 'What we will ask you for', { x: M, y: 7.95, w: 4, h: 0.26, fontSize: 11, bold: true, color: C.navy });
    const need = [['idcard', 'Director and subscriber KYC'], ['building', 'Registered office proof'], ['key', 'DSC details'], ['briefcase', 'Proposed names and capital']];
    const nw = (CW - 0.45) / 4;
    need.forEach(([ic, t], i) => {
      const x = M + i * (nw + 0.15);
      ico(s, ic, x, 8.3, 0.34, HEX.orange, HEX.tint);
      T(s, t, { x: x + 0.42, y: 8.28, w: nw - 0.45, h: 0.4, fontSize: 8.3, bold: true, color: C.navy, valign: 'middle' });
    });
    T(s, 'Each item arrives as a request in the client portal, so nothing is lost in email.', { x: M, y: 8.8, w: CW, h: 0.22, fontSize: 8, italic: true, color: C.muted });
    strip(s, 9.3, 1.2, 'After go-live.', 'SBC’s team keeps running the compliance calendar with you every month. Each filing is approved by a manager, recorded with its proof in the filings register, and shown in your portal the same day.', { fill: C.navy, leadColor: C.orange, color: C.white });
  }

  // =============== 13. WHY ===============
  pres.addSection({ title: 'Why VCFO Suite' });
  {
    const s = page('Why VCFO Suite');
    head(s, 'WHY VCFO SUITE', 'Not another tracker. A managed outcome',
      'Ten things set VCFO Suite apart. Together they mean a company is incorporated properly and then kept compliant, by software and a team that answer for the result.');
    const u = [
      ['U1', 'One app from incorporation to compliance', 'The same record runs from the questionnaire to every annual filing. No hand-over and no re-entry.'],
      ['U2', 'Documents write themselves', 'MCA drafts are generated from the checklist, one set per director, and download as one ZIP.'],
      ['U3 · U4', 'Checked work, shared with the client', 'A manager approves every draft before the client sees it, in the client’s own portal and on their phone.'],
      ['U5 · U6', 'The app chases and answers', 'Request lists, expiry and notice alerts and client health run on their own. Ask VCFO answers from the live record.'],
      ['U7 · U8', 'The board and the cash, too', 'Board meetings run end to end, and receivables come with bank matching and a forex desk.'],
      ['U9 · U10', 'India-native, with a CA team behind it', 'SPICe+, REG-01 and the Indian calendar are built in, and SBC’s CA and CMA team is accountable for the outcome.'],
    ];
    const cw = (CW - 0.3) / 3, ch = 2.08;
    u.forEach(([c, t, b], i) => {
      const x = M + (i % 3) * (cw + 0.15), y = 2.55 + Math.floor(i / 3) * (ch + 0.15);
      const dark = i < 3;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: dark ? C.navy : C.white }, line: dark ? { type: 'none' } : { color: HEX.line, width: 0.75 } });
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.06, fill: { color: C.orange }, line: { type: 'none' } });
      T(s, c, { x: x + 0.16, y: y + 0.2, w: cw - 0.3, h: 0.38, fontSize: c.length > 3 ? 15 : 20, bold: true, color: dark ? C.orange : C.orangeText, fontFace: MONO, valign: 'middle' });
      T(s, t, { x: x + 0.16, y: y + 0.66, w: cw - 0.3, h: 0.45, fontSize: 9.8, bold: true, color: dark ? C.white : C.navy, lineSpacingMultiple: 1.0 });
      T(s, b, { x: x + 0.16, y: y + 1.13, w: cw - 0.3, h: 0.9, fontSize: 8.2, color: dark ? HEX.soft : C.muted, lineSpacingMultiple: 1.1 });
    });
    const by = 7.05, bw = (CW - 0.2) / 2, bh = 3.35;
    const cmp = [
      ['Compared to email + Excel', ['One record, instead of copies in every inbox.', 'Documents generated from answers, not retyped for each director.', 'The client sees status without having to ask.', 'Every action sits in the audit log, not lost in a thread.', 'Reminders and escalations run without anyone remembering them.']],
      ['Compared to generic practice-management or task tools', ['The 34 SPICe+ steps, REG-01 and the Indian calendar come built in.', 'MCA drafts are generated, not attached by hand.', 'The client gets a portal, not a guest login to a task board.', 'Board meetings and receivables live on the same company record.', 'SBC’s CA and CMA team comes with it, accountable for the outcome.']],
    ];
    cmp.forEach(([t, list], i) => {
      const x = M + i * (bw + 0.2);
      s.addShape(pres.shapes.RECTANGLE, { x, y: by, w: bw, h: bh, fill: { color: C.off }, line: { type: 'none' } });
      T(s, t, { x: x + 0.2, y: by + 0.18, w: bw - 0.4, h: 0.45, fontSize: 10.5, bold: true, color: C.navy, lineSpacingMultiple: 1.0 });
      list.forEach((l, k) => {
        const y = by + 0.75 + k * 0.5;
        ico(s, 'tick', x + 0.2, y + 0.03, 0.22, HEX.green);
        T(s, l, { x: x + 0.5, y, w: bw - 0.7, h: 0.44, fontSize: 8.5, color: C.navy, lineSpacingMultiple: 1.05 });
      });
    });
  }

  // =============== 14. BACK COVER ===============
  pres.addSection({ title: 'Contact' });
  {
    const s = pres.addSlide({ masterName: 'VCFO cover', sectionTitle: 'Contact' });
    s.addImage({ data: LOGO.onBlack, x: M, y: 0.85, w: 2.3, h: 2.3 / LOGO.ratio, altText: 'VCFO Suite by SBC logo' });
    label(s, 'GET STARTED', M, 2.3, 3, C.orange);
    T(s, 'Let’s set up your company properly', { x: M, y: 2.6, w: 6.5, h: 1.3, fontSize: 32, bold: true, color: C.white, lineSpacingMultiple: 0.95 });
    T(s, 'Choose where to start. Each option is a conversation with SBC’s team, with the app open on the table.', { x: M, y: 4.0, w: 6.2, h: 0.6, fontSize: 11.5, color: HEX.soft });
    const opts = [
      ['play', 'Live demo', 'See the checklist, the document pack, the approval gate and the client portal on a working company.'],
      ['building', 'Incorporation consultation', 'Talk through structure, capital, directors and the order of filings for your new company or Indian subsidiary.'],
      ['stethoscope', 'Compliance health check', 'We load an existing company’s obligations into the calendar and show what is due, late or missing.'],
    ];
    opts.forEach(([ic, t, b], i) => {
      const y = 4.95 + i * 1.32;
      const act = i === 0;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: CW, h: 1.15, rectRadius: 0.08, fill: { color: act ? C.brand : C.navy2 }, line: act ? { type: 'none' } : { color: C.navy3, width: 0.75 } });
      ico(s, ic, M + 0.25, y + 0.3, 0.55, act ? HEX.brand : HEX.navy, act ? HEX.white : HEX.orange);
      T(s, t, { x: M + 1.05, y: y + 0.2, w: CW - 1.3, h: 0.3, fontSize: 13, bold: true, color: C.white });
      T(s, b, { x: M + 1.05, y: y + 0.55, w: CW - 1.3, h: 0.5, fontSize: 9.5, color: act ? C.white : HEX.soft });
    });
    const cy = 9.1;
    s.addShape(pres.shapes.LINE, { x: M, y: cy, w: CW, h: 0, line: { color: HEX.navy3, width: 0.75 } });
    [['mail', 'info@sbcllp.in', 0], ['globe', 'app.sbctrack.in', 2.05], ['building', 'Steadfast Business Consulting', 4.15]].forEach(([ic, t, dx]) => {
      const x = M + dx;
      ico(s, ic, x, cy + 0.32, 0.3, HEX.orange);
      T(s, t, { x: x + 0.42, y: cy + 0.3, w: 2.6, h: 0.34, fontSize: 10, bold: true, color: C.white, valign: 'middle' });
    });
    T(s, 'VCFO Suite is a product of Steadfast Business Consulting, a CA and CMA-led firm.', { x: M, y: 10.9, w: CW, h: 0.25, fontSize: 8.5, color: HEX.soft });
  }

  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log('wrote', out);
}

main(process.argv[2] || 'VCFO_Suite_Brochure.pptx').catch((e) => { console.error(e); process.exit(1); });
