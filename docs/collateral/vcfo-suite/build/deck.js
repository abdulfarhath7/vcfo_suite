// VCFO Suite corporate deck: 14 slides, 16:9 (10 x 5.625 in), speaker notes on every slide.
const pptxgen = require('pptxgenjs');
const { HEX, THEME, MONO, SOON, LOGO, loadIcons, mkDraw } = require('./shared');
const { applyTheme } = require('./vendor/apply_theme.js');

const W = 10, H = 5.625, M = 0.5, CW = W - 2 * M;

async function main(out) {
  const I = await loadIcons();
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = 'VCFO Suite corporate deck';
  pres.author = 'Steadfast Business Consulting';
  pres.company = 'Steadfast Business Consulting';
  // Type scale (pt): 7 tag and badge · 7.5 caption and footer · 9 small text · 10 body ·
// 12 card titles · 14 large card titles · 16 codes · 28 titles · 36 figures · 38 cover.
  const TYPE = [[7.2, 7], [7.9, 7.5], [9.0, 9], [10.6, 10], [13.0, 12], [14.5, 14], [17, 16], [30, 28], [37, 36], [99, 38]];
  const { C, T, ico, pill, code, soon, card } = mkDraw(pres, I, { typeScale: TYPE });

  const ph = (dark) => [
    { placeholder: { options: { name: 'eyebrow', type: 'body', x: M, y: 0.36, w: CW, h: 0.2, fontSize: 9, bold: true, color: dark ? C.orange : C.orangeText, margin: 0, valign: 'top', charSpacing: 1.5, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.58, w: CW, h: 0.5, fontSize: 28, bold: true, color: dark ? C.white : C.navy, margin: 0, valign: 'top', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'lede', type: 'body', x: M, y: 1.12, w: 8.2, h: 0.46, fontSize: 11.5, color: dark ? HEX.soft : C.muted, margin: 0, valign: 'top', align: 'left' }, text: '' } },
    { image: { data: dark ? LOGO.onBlack : LOGO.onWhite, x: M, y: H - 0.38, w: 0.2 * LOGO.ratio, h: 0.2, altText: 'VCFO Suite logo' } },
    { text: { text: 'Confidential · 2026', options: { x: M + 0.9, y: H - 0.38, w: 3, h: 0.2, fontSize: 7.5, color: dark ? HEX.soft : C.muted, margin: 0, valign: 'middle' } } },
  ];
  pres.defineSlideMaster({ title: 'Deck light', background: { color: C.white }, objects: ph(false), slideNumber: { x: W - M - 0.5, y: H - 0.38, w: 0.5, h: 0.2, fontSize: 7.5, color: C.muted, align: 'right', margin: 0 } });
  pres.defineSlideMaster({ title: 'Deck navy', background: { color: C.navy }, objects: ph(true), slideNumber: { x: W - M - 0.5, y: H - 0.38, w: 0.5, h: 0.2, fontSize: 7.5, color: HEX.soft, align: 'right', margin: 0 } });
  pres.defineSlideMaster({ title: 'Deck cover', background: { color: C.navy }, objects: [] });

  const slide = (dark, section) => pres.addSlide({ masterName: dark ? 'Deck navy' : 'Deck light', sectionTitle: section });
  const head = (s, eyebrow, title, lede) => {
    s.addText(eyebrow, { placeholder: 'eyebrow' });
    s.addText(title, { placeholder: 'title' });
    if (lede) s.addText(lede, { placeholder: 'lede' });
  };
  const navyCard = (s, x, y, w, h, fill = C.navy2) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.07, fill: { color: fill }, line: { color: HEX.navy3, width: 0.75 } });

  // 1 ─ Title
  pres.addSection({ title: 'Opening' });
  {
    const s = pres.addSlide({ masterName: 'Deck cover', sectionTitle: 'Opening' });
    s.addImage({ data: I.rule, x: 0, y: 0, w: W, h: 0.06, altText: 'Brand gradient rule' });
    s.addImage({ data: LOGO.onBlack, x: M, y: 0.5, w: 2.0, h: 2.0 / LOGO.ratio, altText: 'VCFO Suite by SBC logo' });
    pill(s, 'COMPLIANCE COCKPIT', M, 1.55, { h: 0.28, size: 8.5, line: HEX.orange, color: C.orange, charSpacing: 1.5, w: 1.9 });
    T(s, [{ text: 'Incorporation to every filing. ', options: { color: C.white } }, { text: 'One app.', options: { color: C.orange } }], { x: M, y: 1.98, w: 5.4, h: 1.4, fontSize: 38, bold: true, lineSpacingMultiple: 0.95 });
    T(s, 'VCFO Suite · Powered by Steadfast Business Consulting', { x: M, y: 3.55, w: 5.4, h: 0.3, fontSize: 12.5, color: HEX.soft });
    T(s, 'Confidential · 2026', { x: M, y: H - 0.5, w: 3, h: 0.25, fontSize: 9, color: HEX.soft });
    const q = [['building', 'Set up the company', 'U1 · U2'], ['calendar', 'Keep it compliant', 'U5 · U6 · U9'], ['board', 'Run the board and the money', 'U7 · U8'], ['shield', 'See and trust everything', 'U3 · U4']];
    q.forEach(([ic, t, c], i) => {
      const x = 6.35, y = 0.95 + i * 0.95;
      navyCard(s, x, y, 3.15, 0.8);
      ico(s, ic, x + 0.18, y + 0.17, 0.46, HEX.navy, HEX.orange);
      T(s, t, { x: x + 0.78, y: y + 0.14, w: 2.25, h: 0.28, fontSize: 11, bold: true, color: C.white, valign: 'middle' });
      T(s, c, { x: x + 0.78, y: y + 0.44, w: 2.25, h: 0.22, fontSize: 8, color: C.orange, fontFace: MONO, bold: true });
    });
    s.addNotes('Thank you for the time. VCFO Suite is the app Steadfast Business Consulting uses to take an Indian company from the decision to incorporate all the way to every filing, every year. The important word is one: one app, one record and one team. On the right are the four jobs it does, and the codes beside them are the ten things that only VCFO Suite does. I will come back to those codes throughout the next few slides.');
  }

  // 2 ─ Problem
  {
    const s = slide(false, 'Opening');
    head(s, 'THE PROBLEM', 'Three places where the work breaks', 'Founders, CFOs and foreign parents tell us the same story. Effort is never the issue; the work is spread across tools that do not talk to each other.');
    const p = [
      ['mail', 'Incorporation on email and Excel', 'The status sits in someone’s inbox, so the client never knows where things stand without calling.'],
      ['docs', 'Same data typed ten times', 'Every director’s details are retyped into each MCA document. One typo means a resubmission.'],
      ['calendar', 'Compliance in a diary after the COI', 'Once the certificate arrives, the calendar moves to another tool or a diary, and due dates slip.'],
    ];
    const cw = (CW - 0.4) / 3;
    p.forEach(([ic, t, b], i) => card(s, { x: M + i * (cw + 0.2), y: 1.8, w: cw, h: 2.4, bar: C.red, iconName: ic, iconColor: HEX.white, iconBg: HEX.red, iconSize: 0.5, title: t, titleLines: 2, body: b, titleSize: 13, bodySize: 10.5, pad: 0.2 }));
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.38, w: CW, h: 0.55, rectRadius: 0.06, fill: { color: C.tint }, line: { type: 'none' } });
    T(s, [{ text: 'And then:  ', options: { bold: true, color: C.brandText } }, { text: 'licences and DSCs lapse silently, tax notices are answered late, board papers scatter across inboxes and collections are chased by hand.', options: { color: C.navy } }], { x: M + 0.2, y: 4.38, w: CW - 0.4, h: 0.55, fontSize: 10.5, valign: 'middle' });
    s.addNotes('Here is what we hear at almost every first meeting. The incorporation runs on email, WhatsApp and Excel, so the founder has to call us to know the status. The same director details get typed into ten documents, and one typo sends the filing back. And once the certificate of incorporation arrives, compliance moves into a diary or a different tool. After that come the quieter failures: lapsed licences, late notice replies, scattered board papers and collections chased by hand.');
  }

  // 3 ─ Cost (navy)
  {
    const s = slide(true, 'Opening');
    head(s, 'THE COST OF GETTING IT WRONG', 'Small slips, real costs', 'Each of these is a real, published cost. SBC will fill in the figures from the statute and its own practice before this deck is used.');
    const t = [
      ['Late fee per day', 'for a delayed ROC filing', '[SBC to confirm: late fee per day for ROC filings]'],
      ['Months lost', 'when incorporation runs on email', '[SBC to confirm: typical months lost]'],
      ['Penalty example', 'from one missed GST, TDS or ROC date', '[SBC to confirm: penalty example]'],
    ];
    const cw = (CW - 0.4) / 3;
    t.forEach(([big, lab, phd], i) => {
      const x = M + i * (cw + 0.2), y = 1.85;
      navyCard(s, x, y, cw, 2.55);
      T(s, '[ — ]', { x: x + 0.25, y: y + 0.25, w: cw - 0.5, h: 0.7, fontSize: 36, bold: true, color: C.orange, fontFace: MONO });
      T(s, big, { x: x + 0.25, y: y + 1.05, w: cw - 0.5, h: 0.32, fontSize: 14, bold: true, color: C.white });
      T(s, lab, { x: x + 0.25, y: y + 1.38, w: cw - 0.5, h: 0.3, fontSize: 10.5, color: HEX.soft });
      T(s, phd, { x: x + 0.25, y: y + 1.85, w: cw - 0.5, h: 0.5, fontSize: 8.5, color: C.orange, fontFace: MONO });
    });
    T(s, 'Sources: [SBC to confirm: cite the Companies Act 2013, CGST Act or Income-tax Act section behind each figure].', { x: M, y: 4.62, w: CW, h: 0.25, fontSize: 8, italic: true, color: HEX.soft });
    s.addNotes('Why does this matter? Because each slip has a price. A late ROC filing carries a fee for every day it is late. An incorporation run on email can lose months. And a missed GST, TDS or ROC date can turn into a penalty and an uncomfortable conversation with the directors. SBC will put the exact figures here from the statute and from our own practice, with the source cited underneath, so every number on this slide can be checked.');
  }

  // 4 ─ The whole tool
  pres.addSection({ title: 'Product' });
  {
    const s = slide(false, 'Product');
    head(s, 'VCFO SUITE', 'The whole tool on one slide', 'Four jobs, one company record. Everything a company needs from the first questionnaire to every annual filing.');
    const q = [
      ['building', 'Set up the company', 'The 34-step SPICe+ checklist, MCA drafts generated per director, GST REG-01 and every other registration.', ['U1', 'U2'], C.orange],
      ['calendar', 'Keep it compliant', 'A yearly calendar for GST, TDS, PF, ESI, ROC and FEMA; a filings register; automation; Ask VCFO.', ['U5', 'U6', 'U9'], C.blue],
      ['board', 'Run the board and the money', 'Board meetings from notice to signed resolution; receivables with bank matching; payroll and labour registers.', ['U7', 'U8'], C.green],
      ['shield', 'See and trust everything', 'Client portal, firm cockpit, manager approval gate, audit log, encrypted vault and two-step sign-in.', ['U3', 'U4'], C.navy],
    ];
    const cw = (CW - 0.2) / 2, ch = 1.52;
    q.forEach(([ic, t, b, codes, bar], i) => {
      const x = M + (i % 2) * (cw + 0.2), y = 1.75 + Math.floor(i / 2) * (ch + 0.15);
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.white }, line: { color: HEX.line, width: 0.75 } });
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.06, fill: { color: bar }, line: { type: 'none' } });
      ico(s, ic, x + 0.2, y + 0.25, 0.55, HEX.white, HEX.navy);
      T(s, t, { x: x + 0.92, y: y + 0.22, w: cw - 2.0, h: 0.32, fontSize: 13, bold: true, color: C.navy, valign: 'middle' });
      let cx = x + cw - 0.2;
      [...codes].reverse().forEach((c) => { cx -= 0.38; code(s, c, cx, y + 0.27, { fill: C.orange, color: C.navy, w: 0.34 }); cx -= 0.04; });
      T(s, b, { x: x + 0.92, y: y + 0.6, w: cw - 1.1, h: 0.8, fontSize: 10, color: C.muted, lineSpacingMultiple: 1.1 });
    });
    s.addNotes('This is the whole product on one slide. First, we set up the company: the SPICe+ checklist, the MCA documents and the registrations. Second, we keep it compliant with a yearly calendar, a filings register, automation and Ask VCFO. Third, we run the board and the money, with board meetings, receivables and payroll. Fourth, everyone can see and trust what is happening. The orange codes show where each of the ten unique features lives.');
  }

  // 5 ─ Capabilities
  {
    const s = slide(false, 'Product');
    head(s, 'PLATFORM CAPABILITIES', 'Six modules on one record', 'Each module reads and writes the same company record, so the data entered on day one is still the data used at every filing.');
    const m = [
      ['checklist', 'Incorporation engine', '34 SPICe+ steps in MCA order. Steps open in sequence; red marks show missing fields; auto-save.', false],
      ['docs', 'Document generator', 'MOA, AOA, DIR-2, DIR-8, declarations, letters and board resolution, per director, in one ZIP.', false],
      ['calendar', 'Compliance calendar', 'GST, TDS, PF, ESI, ROC/MCA and FEMA events, reminders, filings register with proof.', false],
      ['board', 'Board meetings', '224-item agenda library, Word notice, Teams link, Yes/No replies, quorum, MoM signing.', false],
      ['wallet', 'Receivables', 'Reminders, partner logins, camt bank matching, nine currencies, ageing and cash forecast.', true],
      ['table', 'Payroll and labour registers', 'Salary updates, payroll summary and statutory registers per establishment.', true],
    ];
    const cw = (CW - 0.4) / 3, ch = 1.58;
    const fam = ['orange', 'orange', 'blue', 'green', 'green', 'green'];
    m.forEach(([ic, t, b, sn], i) => card(s, { x: M + (i % 3) * (cw + 0.2), y: 1.72 + Math.floor(i / 3) * (ch + 0.13), w: cw, h: ch, bar: C[fam[i]], iconName: ic, iconColor: HEX[fam[i]], iconSize: 0.3, title: t, body: b, titleSize: 11.5, bodySize: 9.3, soonTag: sn }));
    s.addNotes('Six modules sit on that one record. The incorporation engine runs the 34 SPICe+ steps in MCA order. The document generator turns the answers into every MCA draft, per director. The compliance calendar takes over after incorporation. Board meetings run from notice to signed minutes. Receivables and payroll with labour registers are built and are being rolled out now, which is why they carry the coming soon tag. The point is that none of these needs the data typed in again.');
  }

  // 6 ─ What makes it different (navy)
  {
    const s = slide(true, 'Product');
    head(s, 'WHAT MAKES IT DIFFERENT', 'Ten things only VCFO Suite does', 'The first four, in white, are the reason most clients choose us. The other six are why they stay.');
    const u = [
      ['U1', 'Incorporation to compliance'], ['U2', 'Documents write themselves'], ['U3', 'Manager approval gate'], ['U4', 'The client is inside the app'], ['U5', 'The app chases for you'],
      ['U6', 'Ask VCFO knows the actual status'], ['U7', 'Board meetings end to end'], ['U8', 'Receivables with forex'], ['U9', 'India-native, not adapted'], ['U10', 'Platform + CA/CMA team'],
    ];
    const sub = {
      U1: 'One app, same record, no re-entry.', U2: 'MCA drafts per director, one ZIP.', U3: 'Nothing reaches the client unchecked.', U4: 'Own portal, own phone.', U5: 'Request lists, expiry, notices, health.',
      U6: 'Answers from the client’s files.', U7: 'Notice, Teams, Yes/No, minutes.', U8: 'Bank matching; cash for the CFO.', U9: 'SPICe+, REG-01, GST to FEMA.', U10: 'One accountable engagement.',
    };
    const soonSet = new Set(['U5', 'U8']);
    const tw = (CW - 4 * 0.15) / 5, th = 1.55;
    u.forEach(([c, t], i) => {
      const x = M + (i % 5) * (tw + 0.15), y = 1.72 + Math.floor(i / 5) * (th + 0.15);
      const hot = i < 4;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: tw, h: th, rectRadius: 0.07, fill: { color: hot ? C.white : C.navy2 }, line: hot ? { type: 'none' } : { color: HEX.navy3, width: 0.75 } });
      if (hot) s.addShape(pres.shapes.RECTANGLE, { x, y, w: tw, h: 0.06, fill: { color: C.orange }, line: { type: 'none' } });
      T(s, c, { x: x + 0.15, y: y + 0.12, w: 0.8, h: 0.34, fontSize: 15, bold: true, color: hot ? C.orangeText : C.orange, fontFace: MONO });
      if (soonSet.has(c) && SOON) pill(s, 'SOON', x + tw - 0.55, y + 0.17, { h: 0.18, size: 6, fill: HEX.cautionSoft, color: HEX.caution, w: 0.42, charSpacing: 0.4 });
      T(s, t, { x: x + 0.15, y: y + 0.5, w: tw - 0.25, h: 0.55, fontSize: 10, bold: true, color: hot ? C.navy : C.white, lineSpacingMultiple: 1.0 });
      T(s, sub[c], { x: x + 0.15, y: y + 1.05, w: tw - 0.25, h: 0.42, fontSize: 8, color: hot ? C.muted : HEX.soft, lineSpacingMultiple: 1.05 });
    });
    s.addNotes('If you remember one slide, make it this one. These are the ten things that set VCFO Suite apart. The four in white matter most: incorporation and compliance on one record, documents that write themselves, a manager approval gate so nothing unchecked reaches the client, and the client working inside the app instead of chasing emails. The other six, from automation and Ask VCFO to board meetings, receivables and our own CA team, are why clients stay with us year after year.');
  }

  // 7 ─ How one step moves
  {
    const s = slide(false, 'Product');
    head(s, 'HOW ONE STEP MOVES', 'Every step passes a manager first', 'This is the approval gate (U3). It applies to checklist steps, documents, board notices and filings alike.');
    const f = [
      ['pen', 'Lead or client fills', 'Fields save as they type.'],
      ['checklist', 'Lead submits', 'Missing fields are checked first.'],
      ['eye', 'Manager reviews', 'Approves or sends it back.'],
      ['user', 'Client sees approved work', 'Drafts stay hidden until then.'],
      ['bell', 'Everyone is told', 'Email, in-app bell, WhatsApp.'],
    ];
    const bw = (CW - 4 * 0.3) / 5, by = 1.85, bh = 2.1;
    f.forEach(([ic, t, b], i) => {
      const x = M + i * (bw + 0.3);
      const gate = i === 2;
      s.addShape(pres.shapes.RECTANGLE, { x, y: by, w: bw, h: bh, fill: { color: gate ? C.navy : C.off }, line: { type: 'none' } });
      T(s, String(i + 1), { x: x + 0.15, y: by + 0.14, w: 0.4, h: 0.3, fontSize: 12, bold: true, color: gate ? C.orange : C.orangeText, fontFace: MONO });
      ico(s, ic, x + 0.15, by + 0.55, 0.5, gate ? HEX.navy : HEX.white, HEX.orange);
      T(s, t, { x: x + 0.15, y: by + 1.15, w: bw - 0.25, h: 0.48, fontSize: 11, bold: true, color: gate ? C.white : C.navy, lineSpacingMultiple: 1.0 });
      T(s, b, { x: x + 0.15, y: by + 1.62, w: bw - 0.25, h: 0.42, fontSize: 9, color: gate ? HEX.soft : C.muted });
      if (i < 4) T(s, '→', { x: x + bw, y: by + bh / 2 - 0.2, w: 0.3, h: 0.4, fontSize: 16, bold: true, color: C.orange, align: 'center', valign: 'middle' });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.2, w: CW, h: 0.6, rectRadius: 0.06, fill: { color: C.tint }, line: { type: 'none' } });
    T(s, [{ text: 'Every action in this loop is written to the append-only audit log.  ', options: { bold: true, color: C.navy } }, { text: 'Email is the system of record; WhatsApp is an extra nudge that never blocks it.', options: { color: C.muted } }], { x: M + 0.2, y: 4.2, w: CW - 0.4, h: 0.6, fontSize: 10, valign: 'middle' });
    s.addNotes('Here is how a single step moves through the app. The lead, or the client, fills it in, and it saves as they type. When the lead submits, the app checks for missing fields first. Then a manager reviews it, and only after approval does the client see it. Everyone is told by email, the in-app bell and WhatsApp. Every action in this loop is logged. This is what we mean when we say nothing reaches the client unchecked.');
  }

  // 8 ─ Between meetings (navy)
  {
    const s = slide(true, 'Product');
    head(s, 'AUTOMATION AND ASK VCFO', 'The app works between meetings', 'It chases files, watches expiries and notices, scores client health, and answers questions from the live record (U5 and U6).');
    const a = [
      ['inbox', 'Request lists', 'Email, then WhatsApp, then a call task.', null],
      ['clock', 'Expiry alerts', 'Licences, DSCs, registrations; renewal task opens itself.', 'T-60 · T-30 · T-7'],
      ['alert', 'Notice escalations', 'Tax notices tracked to the reply date.', 'T-7 · T-2'],
      ['heart', 'Client health', 'Nightly score; SLA ladder lead → manager → partner.', null],
    ];
    const lw = 5.35, cw = (lw - 0.15) / 2, ch = 1.45;
    a.forEach(([ic, t, b, big], i) => {
      const x = M + (i % 2) * (cw + 0.15), y = 1.75 + Math.floor(i / 2) * (ch + 0.15);
      navyCard(s, x, y, cw, ch);
      ico(s, ic, x + 0.15, y + 0.15, 0.38, HEX.navy, HEX.orange);
      T(s, t, { x: x + 0.62, y: y + 0.15, w: cw - 0.75, h: 0.38, fontSize: 11, bold: true, color: C.white, valign: 'middle' });
      if (big) T(s, big, { x: x + 0.15, y: y + 0.62, w: cw - 0.3, h: 0.3, fontSize: 12, bold: true, color: C.orange, fontFace: MONO });
      T(s, b, { x: x + 0.15, y: y + (big ? 0.95 : 0.65), w: cw - 0.3, h: 0.45, fontSize: 8.8, color: HEX.soft });
    });
    if (SOON) pill(s, 'AUTOMATION COMING SOON', W - M - 1.75, 0.34, { h: 0.22, size: 6.5, fill: HEX.cautionSoft, color: HEX.caution, line: HEX.cautionLine, w: 1.75, charSpacing: 0.6 });
    const rx = M + lw + 0.25, rw = CW - lw - 0.25;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: 1.75, w: rw, h: 3.05, rectRadius: 0.07, fill: { color: C.white }, line: { type: 'none' } });
    ico(s, 'bot', rx + 0.2, 1.92, 0.42, HEX.navy, HEX.orange);
    T(s, 'Ask VCFO', { x: rx + 0.72, y: 1.92, w: 2, h: 0.42, fontSize: 14, bold: true, color: C.navy, valign: 'middle' });
    code(s, 'U6', rx + rw - 0.6, 2.03, { fill: C.navy, color: C.white, w: 0.4 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx + 1.0, y: 2.48, w: rw - 1.2, h: 0.36, rectRadius: 0.07, fill: { color: C.orange }, line: { type: 'none' } });
    T(s, '“Where is my incorporation?”', { x: rx + 1.1, y: 2.48, w: rw - 1.4, h: 0.36, fontSize: 9.5, bold: true, color: C.navy, valign: 'middle' });
    T(s, 'Answers from the live checklist, explains due dates and rules with citations, and links to the right page.', { x: rx + 0.2, y: 2.95, w: rw - 0.4, h: 0.6, fontSize: 9.3, color: C.navy });
    s.addShape(pres.shapes.LINE, { x: rx + 0.2, y: 3.62, w: rw - 0.4, h: 0, line: { color: HEX.line, width: 0.75 } });
    T(s, '50', { x: rx + 0.2, y: 3.7, w: 0.9, h: 0.6, fontSize: 36, bold: true, color: C.orange, valign: 'middle' });
    T(s, 'files, folders or ZIPs dropped at once, sorted into one review card per client. A person always approves.', { x: rx + 1.1, y: 3.7, w: rw - 1.3, h: 0.65, fontSize: 9, color: C.navy, valign: 'middle' });
    if (SOON) soon(s, rx + 0.2, 4.43);
    s.addNotes('Most missed dates start as a missing file or a forgotten renewal, so the app works between our meetings. It chases the client for files by email, then WhatsApp, then a call task. It alerts sixty, thirty and seven days before a licence or DSC expires, and escalates tax notices before the reply is due. Ask VCFO answers questions from the client’s live record, with citations. Staff can drop up to fifty files at once, and a person always approves what it proposes.');
  }

  // 9 ─ Indian compliance
  {
    const s = slide(false, 'Product');
    head(s, 'BUILT FOR INDIAN COMPLIANCE', 'Indian law is the starting point, not an add-on', 'SPICe+, REG-01 and the statutory calendar are part of the design (U9). Nothing is adapted from a foreign template.');
    const c = [
      ['scale', 'Companies Act 2013 / SPICe+', '34-step checklist, MCA drafts, board resolutions, ROC filings.', false],
      ['receipt', 'GST', 'Registration laid out like REG-01; returns in the yearly calendar.', false],
      ['rupee', 'TDS', 'Deposits and returns tracked with reminders and proof.', false],
      ['users', 'PF and ESI', 'Contributions and returns on the calendar for covered establishments.', false],
      ['globe', 'ROC and FEMA events', 'Annual and event-based filings, including foreign investment reporting.', false],
      ['history', 'Labour laws', 'Statutory registers generated per establishment.', true],
    ];
    const cw = (CW - 0.4) / 3, ch = 1.32;
    c.forEach(([ic, t, b, sn], i) => card(s, { x: M + (i % 3) * (cw + 0.2), y: 1.72 + Math.floor(i / 3) * (ch + 0.12), w: cw, h: ch, bar: C.blue, iconName: ic, iconColor: HEX.blue, iconSize: 0.28, title: t, body: b, titleSize: 11, bodySize: 9, pad: 0.14, soonTag: sn }));
    const chips = ['Five roles', 'Manager approval gate', 'Audit log', 'Encrypted vault', 'Two-step sign-in', 'AWS Mumbai'];
    const cwid = (CW - 5 * 0.1) / 6;
    chips.forEach((t, i) => pill(s, t, M + i * (cwid + 0.1), 4.6, { h: 0.34, size: 8.5, fill: C.navy, color: C.white, w: cwid, charSpacing: 0 }));
    s.addNotes('Everything here was designed for Indian compliance from the start. SPICe+ and the Companies Act drive the incorporation. GST registration looks like the REG-01 tabs on the portal. TDS, PF, ESI, ROC and FEMA events are all in the yearly calendar, and labour registers are being rolled out. Underneath it all sit the controls a finance head expects: five roles, the approval gate, an audit log, an encrypted vault, two-step sign-in and hosting in AWS Mumbai.');
  }

  // 10 ─ Five roles
  {
    const s = slide(false, 'Product');
    head(s, 'ONE APP, FIVE ROLES', 'One record, and each role sees its part', 'Role scoping is applied to every query. A client never sees another client’s data (U3, U4).');
    const hdr = (t) => ({ text: t, options: { bold: true, color: C.muted, fill: { color: HEX.sunken }, fontSize: 8.5, charSpacing: 1 } });
    const rows = [
      ['Super admin', 'Runs the firm: users, settings, every client', 'Everything, firm-wide'],
      ['Admin', 'Runs day-to-day work across clients', 'All clients and reports'],
      ['Manager', 'Reviews and approves the team’s work', 'Team clients, approvals inbox'],
      ['Project lead', 'Fills, drafts and submits the work', 'Assigned clients, My day'],
      ['Client', 'Answers, signs and follows progress', 'Own company, approved work only'],
    ];
    const body = rows.map((r, i) => r.map((c, j) => ({ text: c, options: { fill: { color: i === 4 ? HEX.tint : (i % 2 ? HEX.white : HEX.off) }, bold: j === 0, color: j === 0 ? C.navy : (j === 1 ? C.navy : C.muted) } })));
    s.addTable([[hdr('ROLE'), hdr('MAIN JOB'), hdr('WHAT THEY SEE')], ...body], {
      x: M, y: 1.75, w: 5.7, colW: [1.15, 2.45, 2.1], fontSize: 9.5, fontFace: THEME.bodyFontFace, valign: 'middle', margin: [0.05, 0.1, 0.05, 0.1], border: { type: 'solid', color: HEX.line, pt: 0.5 }, rowH: [0.32, 0.52, 0.52, 0.52, 0.52, 0.52],
    });
    // Screenshot placeholder in a phone frame
    const px = 7.0, pw = 1.75, py = 1.6, phh = 3.35;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px, y: py, w: pw, h: phh, rectRadius: 0.22, fill: { color: C.navy }, line: { type: 'none' } });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px + 0.1, y: py + 0.2, w: pw - 0.2, h: phh - 0.4, rectRadius: 0.1, fill: { color: C.off }, line: { type: 'none' } });
    ico(s, 'phone', px + pw / 2 - 0.22, py + 0.9, 0.44, HEX.orange);
    T(s, '[Screenshot: client portal home on a phone]', { x: px + 0.2, y: py + 1.45, w: pw - 0.4, h: 0.9, fontSize: 8.5, color: C.navy, bold: true, align: 'center', fontFace: MONO });
    T(s, 'Journey map · next step · due dates · documents · requests · messages · vault', { x: px - 0.3, y: py + phh + 0.03, w: pw + 0.6, h: 0.3, fontSize: 7.5, color: C.muted, align: 'center' });
    s.addNotes('Five roles share one app. The super admin and admin run the firm. Managers review and approve. Project leads do the hands-on work and get a My day card each morning. And the client has their own portal, which works on a phone, showing the journey, the next step, due dates and approved documents. The table is simplified: the real rules are enforced on every database query, so a client can never see another client’s data, even by accident.');
  }

  // 11 ─ Proof (navy)
  pres.addSection({ title: 'Proof' });
  {
    const s = slide(true, 'Proof');
    head(s, 'PROOF IN THE PLATFORM', 'Specific, countable and ready to show', null);
    const st = [['34', 'SPICe+ steps', false], ['224', 'agenda items in the library', false], ['9', 'invoice currencies', true], ['AWS', 'Mumbai, ap-south-1', false]];
    const tw = (CW - 3 * 0.15) / 4;
    st.forEach(([big, t, sn], i) => {
      const x = M + i * (tw + 0.15), y = 1.2;
      navyCard(s, x, y, tw, 1.1);
      T(s, big, { x: x + 0.18, y: y + 0.1, w: tw - 0.3, h: 0.6, fontSize: 36, bold: true, color: C.orange, valign: 'middle' });
      T(s, t, { x: x + 0.18, y: y + 0.72, w: tw - 0.3, h: 0.28, fontSize: 9.5, color: C.white });
      if (sn && SOON) pill(s, 'SOON', x + tw - 0.6, y + 0.15, { h: 0.18, size: 6, fill: HEX.cautionSoft, color: HEX.caution, w: 0.42, charSpacing: 0.4 });
    });
    const p = [
      ['docs', 'Per-director MCA drafts', 'One set per director, one ZIP.', false],
      ['shield', 'Manager approval gate', 'Drafts hidden until approved.', false],
      ['board', 'Board meeting loop', 'Notice to signed resolution.', false],
      ['bank', 'Bank auto-matching', 'camt import, TDS tolerance.', true],
      ['bot', 'Ask VCFO with citations', 'Answers from the live record.', false],
      ['history', 'Append-only audit log', 'Every action, who and when.', false],
    ];
    const pw = (CW - 2 * 0.15) / 3, phh = 0.78;
    p.forEach(([ic, t, b, sn], i) => {
      const x = M + (i % 3) * (pw + 0.15), y = 2.48 + Math.floor(i / 3) * (phh + 0.12);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: pw, h: phh, rectRadius: 0.06, fill: { color: C.white }, line: { type: 'none' } });
      ico(s, ic, x + 0.14, y + 0.17, 0.44, HEX.white, HEX.navy);
      T(s, t, { x: x + 0.7, y: y + 0.12, w: pw - 0.8, h: 0.28, fontSize: 10.5, bold: true, color: C.navy, valign: 'middle' });
      T(s, b, { x: x + 0.7, y: y + 0.42, w: pw - 0.8, h: 0.26, fontSize: 9, color: C.muted, valign: 'middle' });
      if (sn && SOON) pill(s, 'SOON', x + pw - 0.55, y + 0.14, { h: 0.18, size: 6, fill: HEX.cautionSoft, color: HEX.caution, w: 0.42, charSpacing: 0.4 });
    });
    T(s, SOON ? 'Every claim here is built and can be shown on a working company. Items marked soon are rolling out now.' : 'Every claim here is a shipped feature we can show live.', { x: M, y: 4.38, w: CW, h: 0.4, fontSize: 11, bold: true, color: C.white, italic: true });
    s.addNotes('We prefer proof to adjectives, so here are the facts. Thirty-four SPICe+ steps. A board agenda library of two hundred and twenty-four items. Invoices in nine currencies. Hosting in AWS Mumbai. Below are six things we can open and show you on a working company today: per-director drafts, the approval gate, the board meeting loop, bank matching, Ask VCFO with citations and the audit log. Bank matching and the currencies are in the receivables module we are rolling out now.');
  }

  // 12 ─ Why SBC
  {
    const s = slide(false, 'Proof');
    head(s, 'WHY SBC + VCFO SUITE', 'One platform, one team, one outcome', 'You do not buy software and get left alone with it. SBC’s team does the work in the app with you (U10).');
    const c = [
      ['briefcase', 'CA/CMA-led', 'Built and run by a CA and CMA-led firm that files for clients every month.'],
      ['flag', 'India-native', 'Designed around SPICe+, REG-01 and the Indian statutory calendar.'],
      ['handshake', 'Software + services in one engagement', 'One team, one contract, one point of accountability for the result.'],
      ['shield', 'Secure, multi-role platform', 'Role scoping, audit log, encrypted vault, two-step sign-in, AWS Mumbai.'],
    ];
    const cw = (CW - 3 * 0.18) / 4;
    c.forEach(([ic, t, b], i) => card(s, { x: M + i * (cw + 0.18), y: 1.8, w: cw, h: 2.6, bar: C.orange, iconName: ic, iconColor: HEX.white, iconBg: HEX.navy, iconSize: 0.6, title: t, titleLines: 2, body: b, titleSize: 12.5, bodySize: 10, pad: 0.2 }));
    s.addNotes('So why SBC and VCFO Suite together? Because we are a CA and CMA-led firm, and we built this for our own practice first. It is India-native, designed around SPICe+ and the Indian calendar. You get software and services in a single engagement, with one team accountable for the result. And it is a secure, multi-role platform. You are not buying a tool and being left alone with it; our team works inside it with you.');
  }

  // 13 ─ Get started (navy)
  pres.addSection({ title: 'Close' });
  {
    const s = slide(true, 'Close');
    head(s, 'GET STARTED', 'Three ways to begin', 'Each one is a conversation with SBC’s team, with the app open on the table.');
    const c = [
      ['play', 'Schedule a demo', 'See the checklist, document pack, approval gate and client portal on a working company.'],
      ['building', 'Start with one company', 'Run one incorporation or one subsidiary end to end, and judge it on the result.'],
      ['stethoscope', 'Book a compliance health check', 'We load an existing company’s obligations and show what is due, late or missing.'],
    ];
    const cw = (CW - 0.4) / 3;
    c.forEach(([ic, t, b], i) => {
      const x = M + i * (cw + 0.2), y = 1.8;
      navyCard(s, x, y, cw, 2.3, i === 0 ? C.brand : C.navy2);
      ico(s, ic, x + 0.22, y + 0.25, 0.6, i === 0 ? HEX.brand : HEX.navy, i === 0 ? HEX.white : HEX.orange);
      T(s, t, { x: x + 0.22, y: y + 1.0, w: cw - 0.4, h: 0.5, fontSize: 13.5, bold: true, color: C.white, lineSpacingMultiple: 1.0 });
      T(s, b, { x: x + 0.22, y: y + 1.5, w: cw - 0.4, h: 0.72, fontSize: 9.8, color: i === 0 ? C.white : HEX.soft });
    });
    T(s, [{ text: 'info@sbcllp.in', options: { bold: true, color: C.white } }, { text: '   ·   ', options: { color: C.orange } }, { text: 'app.sbctrack.in', options: { bold: true, color: C.white } }, { text: '   ·   ', options: { color: C.orange } }, { text: 'Steadfast Business Consulting', options: { color: HEX.soft } }], { x: M, y: 4.38, w: CW, h: 0.4, fontSize: 12, valign: 'middle' });
    s.addNotes('There are three easy ways to start. We can schedule a full demo on a working company. You can start with one company, a new incorporation or one Indian subsidiary, and judge us on the result. Or we can do a compliance health check on an existing company, load its obligations into the calendar and show you what is due, late or missing. Whichever you choose, the contact details are on screen, and we are happy to set up the next step today.');
  }

  // 14 ─ Appendix
  {
    const s = slide(false, 'Close');
    head(s, 'APPENDIX', 'Module reference', null);
    const mods = [
      ['Incorporation engine', '34 SPICe+ steps in MCA order; Part A name, Part B capital, office, directors, subscribers, KYC + DSC; red marks; auto-save.'],
      ['Document generator', 'MOA, AOA, DIR-2, DIR-8, subscription sheets, declarations, letters, board resolution; per director; one ZIP; document pack.'],
      ['Registrations', 'GST laid out like REG-01 tabs; a tracker for every other post-incorporation registration.'],
      ['Compliance calendar', 'GST, TDS, PF, ESI, ROC/MCA, FEMA; reminders; filings register with proof; Mark filed; six status words.'],
      ['Board meetings', '224-item agenda library; manager approval; Word notice, invite, Teams; Yes/No by email; quorum; MoM signing.'],
      ['Receivables' + (SOON ? ' (soon)' : ''), 'Reminders at -5, -3, 0 and daily after; partner logins; camt auto-match; 9 currencies; ageing; forecast.'],
      ['Payroll and labour registers' + (SOON ? ' (soon)' : ''), 'Salary updates; payroll summary; statutory labour registers per establishment.'],
      ['Proactive automation' + (SOON ? ' (soon)' : ''), 'Request lists; T-60/T-30/T-7 expiry; T-7/T-2 notices; client health + SLA ladder; My day; weekly digest.'],
      ['Ask VCFO', 'Status answers; rules with citations; links to the right page; drop of up to 50 files' + (SOON ? ' (soon)' : '') + '; a person approves.'],
      ['Client portal', 'Journey map, snapshot, next step, due dates, documents, requests, messages, team, audit log, vault; phone.'],
      ['Firm cockpit', 'Five roles; manager approval gate; approvals inbox; analytics; practice reports; team load; risks; Outlook mail.'],
      ['Trust and security', 'Role scoping on every query; append-only audit log; encrypted vault; TOTP; AWS Mumbai with RDS and S3.'],
    ];
    const tbl = (list, x) => s.addTable(list.map(([m, f], i) => [
      { text: m, options: { bold: true, color: C.navy, fill: { color: i % 2 ? HEX.white : HEX.off } } },
      { text: f, options: { color: C.muted, fill: { color: i % 2 ? HEX.white : HEX.off } } },
    ]), { x, y: 1.2, w: (CW - 0.2) / 2, colW: [1.3, (CW - 0.2) / 2 - 1.3], fontSize: 8, fontFace: THEME.bodyFontFace, valign: 'middle', margin: [0.04, 0.08, 0.04, 0.08], border: { type: 'solid', color: HEX.line, pt: 0.5 }, rowH: 0.6 });
    tbl(mods.slice(0, 6), M);
    tbl(mods.slice(6), M + (CW - 0.2) / 2 + 0.2);
    s.addNotes('This appendix is for reference after the meeting. It lists all twelve module groups and their main features in one place, from the incorporation engine and document generator through the compliance calendar, board meetings and receivables, to the client portal, firm cockpit and the security controls. Items marked soon are built and are being rolled out to production now. If you would like to see any of these live, we can open the app and show you.');
  }

  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log('wrote', out);
}

main(process.argv[2] || 'VCFO_Suite_Corporate_Deck.pptx').catch((e) => { console.error(e); process.exit(1); });
