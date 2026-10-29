// Run: node scripts/build-incorp-docs-er.mjs
// Builds docs/overview/incorporation-docs-er.html: an ER-style map, written for
// non-technical readers, of which details the incorporation checklist collects,
// at which step, and which documents the app writes from them. The content
// follows src/data/checklist.ts, src/lib/checklist/checklist-responses.ts,
// src/lib/incorporation-docs/* and src/lib/board-resolution/*.
import fs from 'node:fs';

const OUT = process.argv[2] ?? new URL('../docs/overview/incorporation-docs-er.html', import.meta.url).pathname;

// ---------------------------------------------------------------- metrics
const W = 300;                 // box width
const GAPS = [60, 150, 150];   // gaps after columns 0, 1, 2 (room for line labels)
const M = 36;                  // left margin
const RM = 40;                 // right margin
const HEAD = 44;               // box header: title + where-it-comes-from line
const ROW = 16;                // one text line
const ROW_GAP = 3;             // space between rows
const PAD_B = 10;
const TOP = 92;                // y of the first box (lane headers above)
const VGAP = 44;               // vertical gap between boxes in a column
const G_HEAD = 46;             // group header height
const G_PAD = 14;              // group inner padding
const G_GAP = 18;              // gap between boxes inside a group
const FS = 10.5;               // row font size
const CW = FS * 0.55;          // estimated average glyph width (Public Sans), a little generous
const INNER = W - 24;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Greedy word wrap over runs of text; each run keeps its class (lead / rest).
function wrapRuns(runs, maxW) {
  const lines = [];
  let line = [];
  let width = 0;
  for (const run of runs) {
    for (const word of run.text.split(' ')) {
      if (!word) continue;
      const ww = word.length * CW * (run.cls === 'lead' ? 1.06 : 1);
      const sw = line.length ? CW * 0.45 : 0;
      if (line.length && width + sw + ww > maxW) {
        lines.push(line);
        line = [];
        width = 0;
      }
      const last = line[line.length - 1];
      if (last && last.cls === run.cls) last.text += ' ' + word;
      else line.push({ cls: run.cls, text: word });
      width += (line.length > 1 || last ? CW * 0.45 : 0) + ww;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

// ---------------------------------------------------------------- content
// Boxes: { col, title, where, chip, rows: [[lead, rest]] }
// rows for a details box: [detail, note]; rows for a document: [source, what is printed]
const BOXES = {};
const box = (id, spec) => (BOXES[id] = { id, ...spec });

// Column 0 and 1 — details collected
box('project', {
  col: 0, title: 'Project', where: 'Created by the SBC team when the engagement starts', chip: 'team',
  rows: [
    ['Company name', 'as proposed at the start'],
    ['Type of company', 'Indian parent · foreign parent · independent (no parent)'],
    ['Parent company', 'name, address, registration number'],
    ['Indian parent: relationship', 'investing · name use only'],
    ['Client contact', 'the person who gets the portal login'],
  ],
});

box('company', {
  col: 0, title: 'Proposed company', where: 'Step 1 Client Details, then Step 5 Name Approval', chip: 'client-lead',
  rows: [
    ['Two proposed names', 'ending “India Private Limited”'],
    ['Business description', 'up to 100 words'],
    ['NIC codes', 'the main objects of the company'],
    ['Company email and mobile number', ''],
    ['Approved name', 'Step 5 · recorded by the lead from the MCA letter'],
    ['Approval date and expiry', '20-day validity · MCA approval letter attached'],
  ],
});

box('capital', {
  col: 0, title: 'Share capital', where: 'Step 1 Client Details, then Phase 2 · Step 1 Capital Structure', chip: 'client',
  rows: [
    ['Authorised capital', 'INR'],
    ['Initial paid-up capital', 'INR'],
    ['Value of one equity share', 'INR'],
    ['Share classes', 'equity · preference'],
    ['Number of shares in each class', 'Phase 2 · Step 1'],
  ],
});

box('office', {
  col: 0, title: 'Registered office', where: 'Phase 2 · Step 2 Registered Office Address', chip: 'client',
  rows: [
    ['Full address of the proposed office', ''],
    ['State or union territory', ''],
    ['No-objection certificate from the owner', 'file'],
    ['Utility bill', 'type, number and a copy not older than two months'],
  ],
});

box('signing', {
  col: 0, title: 'Signing details', where: 'Phase 2 · Step 5 KYC Review & DSC · documents made here', chip: 'lead',
  rows: [
    ['KYC review', 'approved · corrections requested'],
    ['DSC success proof', 'one per director, from eMudhra'],
    ['Date of signing', 'printed on every draft · blank = the day it is generated'],
    ['Place of signing for resident directors', 'blank = India'],
    ['Witness to the subscribers', 'name, address, occupation, membership number'],
  ],
});

box('parent', {
  col: 1, title: 'Parent company and signatory', where: 'Step 1 Client Details · only for companies with a parent', chip: 'client',
  rows: [
    ['Parent company', 'name, address, registration number, confirmed'],
    ['Country and state of incorporation', ''],
    ['Certificate of incorporation of the parent', 'file'],
    ['Trademark, if any', 'file'],
    ['Authorised signatory', 'first, middle and last name · designation · gender'],
    ['Signatory KYC', 'passport · driving licence · utility bill'],
    ['Date of the board resolution', ''],
  ],
});

box('director', {
  col: 1, title: 'Director', where: 'One entry per director · Phase 2 · Step 3 Proposed Directors', chip: 'client',
  rows: [
    ['Full name and gender', 'names are first asked at Step 1'],
    ['Resident of India?', 'and nationality'],
    ['DIN', 'if they already hold one'],
    ['DSC token', 'has one? expiry date · two slots for video verification'],
    ['Date of birth · father’s name', ''],
    ['Occupation · highest education', ''],
    ['Mobile · personal and official email', ''],
    ['Resident: PAN and Aadhaar', 'numbers and copies'],
    ['Non-resident: passport, driving licence', 'numbers and copies'],
    ['Place of signing', 'non-resident · “City, Country”'],
    ['Proof of identity and proof of residence', 'attached to DIR-2'],
    ['Utility bill and the address on it', 'this address is printed on every document'],
    ['Other companies or LLPs they are part of', 'name, CIN, designation, dates'],
    ['CS membership or COP number', 'if any'],
    ['Passport-size photograph', 'file'],
    ['Notary and apostille', 'self · consultant'],
  ],
});

box('subscriber', {
  col: 1, title: 'Subscriber', where: 'One entry per subscriber · Phase 2 · Step 4 Subscriber Details', chip: 'client',
  rows: [
    ['Type', 'individual (must be a proposed director) · company or LLP'],
    ['Name · CIN or LLPIN · registered address', ''],
    ['Authorised person signing for the company', ''],
    ['Number of shares and their value', ''],
    ['Parent’s authorised person and nominee', 'for INC-35 · nominee holds one share'],
  ],
});

// Column 2 and 3 — documents the app writes
box('br', {
  col: 2, group: 'parentDocs', title: 'Board Resolution / NOC', where: 'Drafted at Step 2 · signed on the parent’s letterhead at Step 3', chip: 'parent-signs',
  rows: [
    ['Parent', 'company name, country and state, signatory name and designation'],
    ['Company', 'proposed names, NIC codes'],
    ['Capital', 'authorised and paid-up capital'],
    ['Directors', 'names, as the persons authorised to incorporate'],
    ['Date', 'the board resolution date from Step 1'],
    ['Wording', 'picked by parent type: foreign · Indian investing · Indian name use'],
  ],
});
box('auth', {
  col: 2, group: 'parentDocs', title: 'Authorisation Letter', where: 'The parent authorises its representative director', chip: 'parent-signs',
  rows: [
    ['Parent', 'name, address, country and state, signatory name and designation'],
    ['Director', 'the non-resident director’s name, address, passport number'],
    ['Company', 'approved name'],
    ['Signing', 'date and place'],
  ],
});
box('accept', {
  col: 2, group: 'parentDocs', title: 'Acceptance Letter', where: 'The representative accepts the appointment', chip: 'director-signs',
  rows: [
    ['Parent', 'name and address'],
    ['Director', 'the non-resident director’s name, father’s name, passport number, address'],
    ['Company', 'approved name · date of the authorisation'],
    ['Signing', 'date and place'],
  ],
});

box('moa', {
  col: 2, group: 'companyDocs', title: 'MOA · INC-33', where: 'Memorandum of Association', chip: 'subscribers-sign',
  rows: [
    ['Company', 'approved name'],
    ['Office', 'state of the registered office'],
    ['Capital', 'authorised and paid-up capital, value per share, number of shares'],
  ],
});
box('aoa', {
  col: 2, group: 'companyDocs', title: 'AOA · INC-34', where: 'Articles of Association', chip: 'subscribers-sign',
  rows: [
    ['Company', 'approved name'],
    ['Directors', 'the list of directors, with Mr. or Ms.'],
  ],
});
box('sheets', {
  col: 2, group: 'companyDocs', title: 'Subscription Sheets', where: 'MOA and AOA · two sheets with the same content', chip: 'subscribers-sign',
  rows: [
    ['Company', 'approved name'],
    ['Subscribers', 'the subscribing company (parent or body corporate) with its representative director, or each individual subscriber'],
    ['Director', 'for each person listed: name, father’s name, address, date of birth, occupation, nationality'],
    ['Capital', 'shares taken by each subscriber, and the total'],
    ['Signing', 'witness name, address, occupation, membership number · date'],
  ],
});

box('dir2', {
  col: 3, group: 'directorDocs', title: 'DIR-2 · Consent to act as director', where: 'One per director', chip: 'director-signs',
  rows: [
    ['Company', 'approved name'],
    ['Director', 'name, DIN, father’s name, address, email, mobile, PAN, occupation, date of birth, nationality'],
    ['Director', 'count of other directorships · CS membership number'],
    ['Director', 'proof of identity · proof of residence'],
    ['Signing', 'date and place'],
  ],
});
box('dir8', {
  col: 3, group: 'directorDocs', title: 'DIR-8 · Not disqualified', where: 'Intimation of disqualification · one per director', chip: 'director-signs',
  rows: [
    ['Company', 'approved name'],
    ['Director', 'name, son or daughter of, father’s name, address'],
    ['Director', 'table of other directorships: company, CIN, from, to'],
    ['Signing', 'date and place'],
  ],
});
box('inc9', {
  col: 3, group: 'directorDocs', title: 'INC-9 · Director declaration', where: 'Declaration by the first director · one per director', chip: 'director-signs',
  rows: [
    ['Company', 'approved name'],
    ['Director', 'name'],
    ['Signing', 'date and place'],
  ],
});
box('idaddr', {
  col: 3, group: 'directorDocs', title: 'ID & Address Declaration', where: 'Only directors who already hold a DIN', chip: 'director-signs',
  rows: [
    ['Company', 'approved name'],
    ['Director', 'name, son or daughter of, father’s name, address, DIN'],
    ['Signing', 'date and place'],
  ],
});
box('deposit', {
  col: 3, group: 'directorDocs', title: 'Deposit Declaration', where: 'Optional · one per director', chip: 'director-signs',
  rows: [
    ['Company', 'approved name'],
    ['Director', 'name, son or daughter of, father’s name, address, DIN'],
    ['Signing', 'date and place'],
  ],
});
box('pan', {
  col: 3, group: 'directorDocs', title: 'PAN Undertaking', where: 'Non-resident directors only', chip: 'director-signs',
  rows: [
    ['Director', 'name, father’s name, nationality, passport number'],
    ['Signing', 'date and place'],
  ],
});

const GROUPS = {
  parentDocs: { col: 2, title: 'Needs the parent company', sub: 'Only when the company has a parent. An independent company skips all three.', boxes: ['br', 'auth', 'accept'] },
  companyDocs: { col: 2, title: 'Once for the company', sub: 'One set per company, whatever the number of directors.', boxes: ['moa', 'aoa', 'sheets'] },
  directorDocs: { col: 3, title: 'One set for every director', sub: 'Made again for each director entry: up to six documents each.', boxes: ['dir2', 'dir8', 'inc9', 'idaddr', 'deposit', 'pan'] },
};

const ORDER = {
  0: ['project', 'company', 'capital', 'office', 'signing'],
  1: ['parent', 'director', 'subscriber'],
  2: ['parentDocs', 'companyDocs'],
  3: ['directorDocs'],
};

const CHIP = {
  team: ['SBC team', 'chip-neutral'],
  client: ['Client fills', 'chip-client'],
  lead: ['Project lead fills', 'chip-lead'],
  'client-lead': ['Client, then lead', 'chip-client'],
  'parent-signs': ['Parent signs', 'chip-neutral'],
  'director-signs': ['Director signs', 'chip-neutral'],
  'subscribers-sign': ['Subscribers sign', 'chip-neutral'],
};

// ---------------------------------------------------------------- layout
const colX = (c) => M + c * W + GAPS.slice(0, c).reduce((a, b) => a + b, 0);
const gapMid = (c) => colX(c) + W + GAPS[c] / 2;

for (const b of Object.values(BOXES)) {
  // The title shares its line with the chip; warn before they collide.
  const chipW = CHIP[b.chip][0].length * 8.5 * 0.56 + 14;
  if (b.title.length * 12.5 * 0.5 + 8 + chipW > INNER) console.log(`WARN title runs under the chip: ${b.title}`);
  if (b.where.length * 9.5 * 0.47 > INNER) console.log(`WARN where-line too long: ${b.where}`);
  let y = HEAD + 4;
  b.lines = [];
  for (const [lead, rest] of b.rows) {
    const runs = [{ cls: 'lead', text: lead }];
    if (rest) runs.push({ cls: 'rest', text: rest });
    const lines = wrapRuns(runs, INNER);
    b.lines.push({ y, lines });
    y += lines.length * ROW + ROW_GAP;
  }
  b.h = y - ROW_GAP + PAD_B;
}

for (const [c, ids] of Object.entries(ORDER)) {
  let y = TOP;
  for (const id of ids) {
    if (GROUPS[id]) {
      const g = GROUPS[id];
      g.x = colX(Number(c)) - G_PAD;
      g.y = y;
      g.w = W + 2 * G_PAD;
      let gy = y + G_HEAD + G_PAD;
      for (const bid of g.boxes) {
        const b = BOXES[bid];
        b.x = colX(Number(c));
        b.y = gy;
        gy += b.h + G_GAP;
      }
      g.h = gy - G_GAP + G_PAD - y;
      y += g.h + VGAP;
    } else {
      const b = BOXES[id];
      b.x = colX(Number(c));
      b.y = y;
      y += b.h + VGAP;
    }
  }
}

const bottomOf = (id) => (GROUPS[id] ? GROUPS[id].y + GROUPS[id].h : BOXES[id].y + BOXES[id].h);
const colBottom = (c) => Math.max(...ORDER[c].map(bottomOf));
const CANVAS_W = colX(3) + W + RM;
const CANVAS_H = Math.max(...[0, 1, 2, 3].map(colBottom)) + 40;
const TOP_CH = 58;

const rowY = (b, i) => b.lines[i].y + b.y + ROW / 2;
const L = (b) => b.x, R = (b) => b.x + W, T = (b) => b.y, B = (b) => b.y + b.h, CX = (b) => b.x + W / 2;

// ---------------------------------------------------------------- lines
const LINES = [];
const D = BOXES;
const G = GROUPS;

// Parent company → the parent documents group (1 — 1, only with a parent)
LINES.push({
  kind: 'rel', start: 'one', end: 'one',
  pts: [[R(D.parent), rowY(D.parent, 0)], [G.parentDocs.x, rowY(D.parent, 0)]],
  label: { text: 'only when there is a parent', x: (R(D.parent) + G.parentDocs.x) / 2, y: rowY(D.parent, 0) - 7, anchor: 'middle' },
});
// Director → the per-director group (1 — many), over the top channel
LINES.push({
  kind: 'rel', start: 'one', end: 'many',
  pts: [
    [R(D.director), rowY(D.director, 0)], [gapMid(1), rowY(D.director, 0)], [gapMid(1), TOP_CH],
    [gapMid(2), TOP_CH], [gapMid(2), G.directorDocs.y + 24], [G.directorDocs.x, G.directorDocs.y + 24],
  ],
  label: { text: 'one set of documents for every director', x: (gapMid(1) + gapMid(2)) / 2, y: TOP_CH + 14, anchor: 'middle' },
});
// Subscribers → subscription sheets (many — 1)
LINES.push({
  kind: 'rel', start: 'many', end: 'one',
  pts: [[R(D.subscriber), rowY(D.subscriber, 0)], [gapMid(1), rowY(D.subscriber, 0)], [gapMid(1), rowY(D.sheets, 1)], [L(D.sheets), rowY(D.sheets, 1)]],
  label: { text: 'every subscriber is listed', x: gapMid(1), y: (rowY(D.subscriber, 0) + rowY(D.sheets, 1)) / 2 - 6, anchor: 'middle' },
});
// Director — Subscriber (an individual subscriber must be a proposed director)
LINES.push({
  kind: 'rel', start: 'one', end: 'zero-one',
  pts: [[CX(D.director) - 90, B(D.director)], [CX(D.director) - 90, T(D.subscriber)]],
  label: { text: 'an individual subscriber is one of the directors', x: CX(D.director) - 78, y: (B(D.director) + T(D.subscriber)) / 2 + 4, anchor: 'start' },
});
// ---------------------------------------------------------------- render
function renderBox(b) {
  const o = [];
  o.push(`<g class="box">`);
  o.push(`<rect class="box-bg" x="${b.x}" y="${b.y}" width="${W}" height="${b.h}" rx="8"/>`);
  o.push(`<text class="box-title" x="${b.x + 12}" y="${b.y + 18}">${esc(b.title)}</text>`);
  o.push(`<text class="box-where" x="${b.x + 12}" y="${b.y + 33}">${esc(b.where)}</text>`);
  const [chipText, chipClass] = CHIP[b.chip];
  const cw = chipText.length * 8.5 * 0.56 + 14;
  o.push(`<rect class="chip ${chipClass}" x="${(b.x + W - 12 - cw).toFixed(1)}" y="${b.y + 7}" width="${cw.toFixed(1)}" height="15" rx="4"/>`);
  o.push(`<text class="chip-text ${chipClass}" x="${(b.x + W - 12 - cw / 2).toFixed(1)}" y="${b.y + 17.5}" text-anchor="middle">${esc(chipText)}</text>`);
  o.push(`<line class="box-rule" x1="${b.x}" y1="${b.y + HEAD - 2}" x2="${b.x + W}" y2="${b.y + HEAD - 2}"/>`);
  for (const row of b.lines) {
    row.lines.forEach((runs, i) => {
      const y = b.y + row.y + i * ROW + ROW - 4;
      const spans = runs.map((r) => `<tspan class="t-${r.cls}">${esc(r.text)}</tspan>`).join('<tspan> </tspan>');
      o.push(`<text class="row" x="${b.x + 12}" y="${y}">${spans}</text>`);
    });
  }
  o.push('</g>');
  return o.join('\n');
}

function renderGroup(g) {
  return [
    `<rect class="group" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="12"/>`,
    `<text class="group-title" x="${g.x + G_PAD}" y="${g.y + 20}">${esc(g.title)}</text>`,
    `<text class="group-sub" x="${g.x + G_PAD}" y="${g.y + 35}">${esc(g.sub)}</text>`,
  ].join('\n');
}

function renderLine(l) {
  const d = l.pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const ms = l.start ? ` marker-start="url(#m-${l.start})"` : '';
  const me = l.end && l.end !== 'none' ? ` marker-end="url(#m-${l.end})"` : '';
  const o = [`<path class="ln ln-${l.kind}" d="${d}"${ms}${me}/>`];
  if (l.label) o.push(`<text class="ln-label" x="${l.label.x}" y="${l.label.y}" text-anchor="${l.label.anchor}">${esc(l.label.text)}</text>`);
  return o.join('\n');
}

const lanes = [
  { x: colX(0), text: 'Details we collect', sub: 'what the client and the project lead fill in, and at which step' },
  { x: colX(2), text: 'Documents the app writes', sub: 'each one is filled from the details on the left, with the signature line left empty' },
];

const svg = [];
svg.push(`<svg class="er" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" width="${CANVAS_W}" height="${CANVAS_H}" role="img" aria-label="Map of the details the incorporation checklist collects, the step each comes from, and the documents the app writes from them: three parent-company documents, one set of up to six documents per director, and four company documents.">`);
svg.push(`<defs>
  <marker id="m-one" viewBox="0 0 22 16" refX="22" refY="8" markerWidth="22" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M13 2 V14" class="mk"/></marker>
  <marker id="m-many" viewBox="0 0 22 16" refX="22" refY="8" markerWidth="22" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M4 8 L22 2 M4 8 L22 8 M4 8 L22 14" class="mk"/></marker>
  <marker id="m-zero-one" viewBox="0 0 26 16" refX="26" refY="8" markerWidth="26" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><circle cx="6" cy="8" r="3.6" class="mk mk-fill"/><path d="M17 2 V14" class="mk"/></marker>
  <marker id="m-arrow" viewBox="0 0 22 16" refX="22" refY="8" markerWidth="22" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M12 3 L22 8 L12 13 Z" class="mk-arrow"/></marker>
</defs>`);
for (const l of lanes) {
  svg.push(`<text class="lane" x="${l.x}" y="${TOP - 62}">${esc(l.text)}</text>`);
  svg.push(`<text class="lane-sub" x="${l.x}" y="${TOP - 48}">${esc(l.sub)}</text>`);
}
for (const g of Object.values(GROUPS)) svg.push(renderGroup(g));
for (const l of LINES) svg.push(renderLine(l));
for (const b of Object.values(BOXES)) svg.push(renderBox(b));
svg.push('</svg>');

// ---------------------------------------------------------------- timeline (HTML)
const STEPS = [
  { phase: 'Before', n: '', title: 'Project created', who: 'team', note: 'Company name, type, parent, client login' },
  { phase: 'Phase 1', n: '1', title: 'Client Details', who: 'client', note: 'Parent, signatory, names, capital, directors' },
  { phase: 'Phase 1', n: '2', title: 'Draft Board Resolution', who: 'lead', note: 'The app drafts it; the lead reviews' },
  { phase: 'Phase 1', n: '3', title: 'Signed Board Resolution', who: 'client', note: 'Signed on the parent’s letterhead' },
  { phase: 'Phase 1', n: '4', title: 'Name Application', who: 'lead', note: 'Filed with the ROC' },
  { phase: 'Phase 1', n: '5', title: 'Name Approval', who: 'lead', note: 'Approved name and MCA letter' },
  { phase: 'Phase 2', n: '1', title: 'Capital Structure', who: 'client', note: 'Share classes, counts, values' },
  { phase: 'Phase 2', n: '2', title: 'Registered Office', who: 'client', note: 'Address, owner NOC, utility bill' },
  { phase: 'Phase 2', n: '3', title: 'Proposed Directors', who: 'client', note: 'One entry per director, with KYC' },
  { phase: 'Phase 2', n: '4', title: 'Subscriber Details', who: 'client', note: 'Who takes the shares' },
  { phase: 'Phase 2', n: '5', title: 'KYC Review & DSC', who: 'lead', note: 'Documents are generated and shared here; signed copies come back', hot: true },
  { phase: 'Phase 2', n: '6', title: 'SPICe+ Confirmation', who: 'client', note: 'Client confirms the filing' },
  { phase: 'Phase 2', n: '7', title: 'SPICe+ Filing', who: 'lead', note: 'Filed on the MCA portal' },
  { phase: 'Phase 2', n: '8', title: 'MCA Remarks', who: 'lead', note: 'Resubmission, if asked' },
  { phase: 'Phase 2', n: '9', title: 'Certificate of Incorporation', who: 'lead', note: 'CIN, PAN, TAN shared with the client' },
];
const WHO = { team: ['SBC team', 'who-neutral'], client: ['Client', 'who-client'], lead: ['Project lead', 'who-lead'] };
const timeline = STEPS.map((s) => {
  const [who, cls] = WHO[s.who];
  return `<li class="step${s.hot ? ' hot' : ''}">
    <span class="step-eyebrow">${esc(s.phase)}${s.n ? ' · Step ' + s.n : ''}</span>
    <span class="step-title">${esc(s.title)}</span>
    <span class="step-note">${esc(s.note)}</span>
    <span class="who ${cls}">${esc(who)}</span>
  </li>`;
}).join('\n');

// ---------------------------------------------------------------- page
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>Incorporation Documents Map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&display=swap">
<style>
  /* Layout: the step timeline first, then one wide ER-style canvas in a horizontal
     scroller. Tokens follow docs/design/design-tokens.json. */
  :root {
    --surface: #f3f5f9; --surface-raised: #ffffff; --surface-sunken: #f5f6f8;
    --line: #e3e6eb; --line-strong: #7a8ca2;
    --ink: #16212f; --ink-muted: #626d7b; --ink-faint: #838c99;
    --brand: #2563a8; --brand-soft: #e6effa;
    --client: #a05d00; --client-soft: #fcefd8;
    --lead: #2563a8; --lead-soft: #e6effa;
    --font-ui: 'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --surface: #111821; --surface-raised: #18202b; --surface-sunken: #1f2935;
      --line: #2c3745; --line-strong: #596c8c;
      --ink: #e6eaf0; --ink-muted: #9aa7b8; --ink-faint: #6f7c8d;
      --brand: #6fa3e0; --brand-soft: #263548;
      --client: #f2a35b; --client-soft: #3f2a16;
      --lead: #6fa3e0; --lead-soft: #263548;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --surface: #111821; --surface-raised: #18202b; --surface-sunken: #1f2935;
    --line: #2c3745; --line-strong: #596c8c;
    --ink: #e6eaf0; --ink-muted: #9aa7b8; --ink-faint: #6f7c8d;
    --brand: #6fa3e0; --brand-soft: #263548;
    --client: #f2a35b; --client-soft: #3f2a16;
    --lead: #6fa3e0; --lead-soft: #263548;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background: var(--surface); color: var(--ink); font-family: var(--font-ui); font-size: 14px; line-height: 1.45;
    padding-block: 28px 48px;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
  }
  header, section, figure { max-width: 1640px; margin-inline: auto; }
  header { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 24px; margin-bottom: 22px; }
  h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0; text-wrap: balance; }
  .lede { color: var(--ink-muted); margin: 4px 0 0; max-width: 78ch; }
  .controls { margin-left: auto; display: flex; gap: 14px; align-items: center; color: var(--ink-muted); font-size: 13px; }
  .controls label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
  h2 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); margin: 0 0 10px; }

  /* timeline */
  .timeline { list-style: none; margin: 0 0 26px; padding: 0; display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); }
  .step { position: relative; background: var(--surface-raised); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px 12px; display: grid; gap: 3px; min-width: 0; }
  .step.hot { border-color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand); }
  .step-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-faint); }
  .step-title { font-weight: 600; font-size: 13px; }
  .step-note { font-size: 12px; color: var(--ink-muted); }
  .who { justify-self: start; margin-top: 4px; font-size: 10.5px; font-weight: 500; padding: 2px 7px; border-radius: 4px; }
  .who-client { background: var(--client-soft); color: var(--client); }
  .who-lead { background: var(--lead-soft); color: var(--lead); }
  .who-neutral { background: var(--surface-sunken); color: var(--ink-muted); }

  /* figure */
  figure { margin: 0; }
  .scroller { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-raised); }
  .scroller svg { display: block; max-width: none; }
  .scroller.fit svg { width: 100%; height: auto; }
  figcaption { color: var(--ink-muted); font-size: 13px; margin: 10px 2px 0; max-width: 100ch; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 22px; align-items: center; color: var(--ink-muted); font-size: 13px; margin-top: 8px; }
  .legend svg { vertical-align: middle; }

  /* SVG */
  .box-bg { fill: var(--surface-raised); stroke: var(--line-strong); stroke-width: 1; }
  .box-rule { stroke: var(--line); stroke-width: 1; }
  .box-title { font: 600 12.5px var(--font-ui); fill: var(--ink); }
  .box-where { font: 400 9.5px var(--font-ui); fill: var(--ink-muted); }
  .row { font: 400 ${FS}px var(--font-ui); fill: var(--ink-muted); }
  .t-lead { font-weight: 500; fill: var(--ink); }
  .chip { stroke: none; }
  .chip-text { font: 500 8.5px var(--font-ui); letter-spacing: 0.02em; }
  .chip.chip-client { fill: var(--client-soft); } .chip-text.chip-client { fill: var(--client); }
  .chip.chip-lead { fill: var(--lead-soft); } .chip-text.chip-lead { fill: var(--lead); }
  .chip.chip-neutral { fill: var(--surface-sunken); } .chip-text.chip-neutral { fill: var(--ink-muted); }
  .group { fill: var(--surface-sunken); stroke: var(--line); stroke-dasharray: 5 4; }
  .group-title { font: 600 12px var(--font-ui); fill: var(--ink); }
  .group-sub { font: 400 10px var(--font-ui); fill: var(--ink-muted); }
  .lane { font: 600 11px var(--font-ui); fill: var(--ink); text-transform: uppercase; letter-spacing: 0.08em; }
  .lane-sub { font: 400 10px var(--font-ui); fill: var(--ink-muted); }
  .ln { fill: none; stroke: var(--line-strong); stroke-width: 1.25; }
  .ln-flow { stroke: var(--brand); stroke-dasharray: 5 3.5; }
  .mk { fill: none; stroke: var(--line-strong); stroke-width: 1.25; }
  .mk-fill { fill: var(--surface-raised); }
  .mk-arrow { fill: var(--brand); stroke: none; }
  .ln-label { font: 400 10px var(--font-ui); fill: var(--ink-muted); paint-order: stroke; stroke: var(--surface-raised); stroke-width: 4px; stroke-linejoin: round; }
</style>
</head>
<body>
<header>
  <div>
    <h1>Incorporation Documents Map</h1>
    <p class="lede">The details the client and the project lead enter during incorporation, the step each one comes from, and the documents the app fills in from them. Nobody retypes a detail: it is entered once and printed wherever it is needed.</p>
  </div>
  <div class="controls">
    <label><input type="checkbox" id="fit"> Fit to width</label>
  </div>
</header>

<section>
  <h2>The steps, in order</h2>
  <ol class="timeline">
${timeline}
  </ol>
</section>

<figure>
  <div class="scroller" id="scroller">
${svg.join('\n')}
  </div>
  <figcaption>Each box on the left is a set of details and says which step collects it. Each box on the right is one document and lists what gets printed in it, and from which set of details. A line with a fork means “many”: one director entry gives a whole set of documents, and every subscriber is listed on the subscription sheets. A subsidiary with one non-resident and one resident director, both holding a DIN, ends up with 18 documents.</figcaption>
  <div class="legend">
    <span><svg width="64" height="16" viewBox="0 0 64 16"><path d="M2 8 H62" class="ln"/><path d="M8 2 V14" class="mk"/><path d="M44 8 L62 2 M44 8 L62 8 M44 8 L62 14" class="mk"/></svg> one — many</span>
    <span><svg width="64" height="16" viewBox="0 0 64 16"><path d="M2 8 H62" class="ln"/><path d="M8 2 V14" class="mk"/><path d="M56 2 V14" class="mk"/></svg> one — one</span>
    <span><svg width="64" height="16" viewBox="0 0 64 16"><path d="M2 8 H62" class="ln"/><path d="M8 2 V14" class="mk"/><circle cx="46" cy="8" r="3.6" class="mk mk-fill"/><path d="M57 2 V14" class="mk"/></svg> one — maybe one</span>
    <span><svg width="64" height="16" viewBox="0 0 64 16"><rect x="2" y="1" width="60" height="14" rx="4" class="group"/></svg> a group of documents</span>
  </div>
</figure>

<script>
  (function () {
    var box = document.getElementById('fit');
    var scroller = document.getElementById('scroller');
    function apply() { scroller.classList.toggle('fit', box.checked); }
    box.addEventListener('change', apply);
    apply();
  })();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, page);
console.log(`wrote ${OUT}`);
console.log(`canvas ${CANVAS_W} x ${CANVAS_H}; bottoms: ${[0, 1, 2, 3].map(colBottom).join(', ')}`);
for (const b of Object.values(BOXES)) console.log(`${b.id.padEnd(10)} col ${b.col} y ${b.y} h ${b.h}`);
