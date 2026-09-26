/**
 * Template edits for the incorporation answers that replaced hardcoded /
 * guessed values (parent country & state, subscription witness, resident
 * subscription sheet). Idempotent: re-running reports "already tagged".
 *
 * - boardResolution.docx: "the State of {PARENT_STATE}" becomes conditional,
 *   so a parent from a country without states reads "the laws of the United
 *   Kingdom, and the governing documents …".
 * - authorisation-letter.docx: same for "the {STATE}, {COUNTRY}", with
 *   `{PARENT_ENTITY_JURISDICTION}` printed when there is no state.
 * - moa-aoa-subscription-sheet-foreign.docx: fixes the page 2 tags (each sat
 *   one label late), prints the share total instead of the parent name in the
 *   TOTAL row, and adds the witness block.
 * - moa-aoa-subscription-sheet-resident.docx: built from the firm's resident
 *   sample (`MOA & AOA Subcription Sheets Resident.docx`) — sample data
 *   stripped, one `{#SUBSCRIBERS}` table row per individual subscriber.
 *
 * Usage: node scripts/incorp-docx-build-sourced-fields.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const TEMPLATES = path.join(process.cwd(), 'public/templates');

// ---------------------------------------------------------------------------
// XML helpers (paragraph / run level; every tag lands in one run)
// ---------------------------------------------------------------------------

const PARA_RE = /<w:p[ >][\s\S]*?<\/w:p>/g;
const RUN_RE = /<w:r[ >][\s\S]*?<\/w:r>/g;
const ROW_RE = /<w:tr[ >][\s\S]*?<\/w:tr>/g;

const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textOf = (xml) =>
  [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/&amp;/g, '&');

function runs(paragraph) {
  return paragraph.match(RUN_RE) ?? [];
}

function runProps(run) {
  return /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(run ?? '')?.[0] ?? '';
}

function makeRun(rPr, text) {
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/**
 * Replace a paragraph's runs. `parts` = [[styleRunIndex, text], …]; each part
 * becomes one run carrying the rPr of the original run at that index (among
 * runs holding text).
 */
function retext(paragraph, parts) {
  const textRuns = runs(paragraph).filter((r) => /<w:t[ >]/.test(r));
  // 'value' = the first run after the label that holds visible text.
  const valueIdx = Math.max(
    1,
    textRuns.findIndex((r, i) => i > 0 && textOf(r).trim() && !/:\s*$/.test(textOf(r))),
  );
  parts = parts.map(([idx, text]) => [idx === 'value' ? valueIdx : idx, text]);
  const open = /^<w:p[ >][^]*?(?:<\/w:pPr>|(?=<w:r[ >])|(?=<\/w:p>))/.exec(paragraph)?.[0] ?? '<w:p>';
  const pPrOnly = open.includes('<w:pPr') ? open : open.replace(/<w:r[ >][\s\S]*$/, '');
  const body = parts
    .map(([idx, text]) => makeRun(runProps(textRuns[Math.min(idx, textRuns.length - 1)]), text))
    .join('');
  return `${pPrOnly}${body}</w:p>`;
}

/** A new paragraph shaped like `model` (its pPr and first run's rPr, bold removed). */
function paragraphLike(model, text) {
  const rPr = runProps(runs(model).find((r) => /<w:t[ >]/.test(r))).replace(/<w:bCs?\/>/g, '');
  const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(model)?.[0] ?? '';
  return `<w:p>${pPr}${makeRun(rPr, text)}</w:p>`;
}

/** Map every paragraph in `xml` through `fn(paragraph, text)`; null deletes it. */
function mapParagraphs(xml, fn) {
  return xml.replace(PARA_RE, (p) => {
    const out = fn(p, textOf(p));
    return out === null ? '' : out;
  });
}

function editDocx(file, edit, { source } = {}) {
  const out = path.join(TEMPLATES, file);
  const from = source ? path.join(TEMPLATES, source) : out;
  const zip = new PizZip(fs.readFileSync(from));
  const before = zip.file('word/document.xml').asText();
  const after = edit(before);
  if (after === null) {
    console.log(`${file}: already tagged`);
    return;
  }
  zip.file('word/document.xml', after);
  fs.writeFileSync(out, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`${file}: written${source ? ` from ${source}` : ''}`);
}

function mustReplace(xml, from, to, label) {
  if (!xml.includes(from)) throw new Error(`${label}: expected ${from} not found`);
  return xml.replace(from, to);
}

// ---------------------------------------------------------------------------
// Board resolution + authorisation letter: optional state
// ---------------------------------------------------------------------------

editDocx('boardResolution.docx', (xml) => {
  if (xml.includes('{#PARENT_STATE}')) return null;
  let next = mustReplace(
    xml,
    '{PARENT_JURISDICTION}, the State of ',
    '{PARENT_JURISDICTION}{#PARENT_STATE}, the State of ',
    'boardResolution.docx',
  );
  next = mustReplace(next, '>{PARENT_STATE}<', '>{PARENT_STATE}{/PARENT_STATE}<', 'boardResolution.docx');
  return next;
});

editDocx('authorisation-letter.docx', (xml) => {
  if (xml.includes('{#PARENT_ENTITY_STATE}')) return null;
  let next = mustReplace(
    xml,
    'under the laws of the <',
    'under the laws of {#PARENT_ENTITY_STATE}the <',
    'authorisation-letter.docx',
  );
  next = mustReplace(
    next,
    '>{PARENT_ENTITY_COUNTRY}<',
    '>{PARENT_ENTITY_COUNTRY}{/PARENT_ENTITY_STATE}{^PARENT_ENTITY_STATE}{PARENT_ENTITY_JURISDICTION}{/PARENT_ENTITY_STATE}<',
    'authorisation-letter.docx',
  );
  return next;
});

// ---------------------------------------------------------------------------
// Subscription sheets: shared witness edits
// ---------------------------------------------------------------------------

const WITNESS_CELL = ['{WITNESS_NAME}', 'Address: {WITNESS_ADDRESS}', 'Occupation: {WITNESS_OCCUPATION}', '{WITNESS_MEMBERSHIP}'];

/** "Witness Statement:" block (outside the tables): name, occupation, address. */
function tagWitnessStatement(xml) {
  const tableRanges = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((m) => [m.index, m.index + m[0].length]);
  const inTable = (offset) => tableRanges.some(([a, b]) => offset >= a && offset < b);
  let seenStatement = false;
  return xml.replace(PARA_RE, (p, offset) => {
    if (inTable(offset)) return p;
    const t = textOf(p).trim();
    if (t === 'Witness Statement:') {
      seenStatement = true;
      return p;
    }
    if (!seenStatement) return p;
    if (t === 'Name of Witness:') return retext(p, [[0, 'Name of Witness: '], [0, '{WITNESS_NAME}']]);
    if (t === 'Occupation:') return retext(p, [[0, 'Occupation: '], [0, '{WITNESS_OCCUPATION}']]);
    if (t === 'Address:') {
      seenStatement = false; // one block per page
      return retext(p, [[0, 'Address: '], [0, '{WITNESS_ADDRESS}']]);
    }
    return p;
  });
}

// ---------------------------------------------------------------------------
// Foreign (body corporate) sheet
// ---------------------------------------------------------------------------

/** Page 2 tags sat one label late; each label → the tag it names. */
const PAGE2_SHIFT = [
  ['PARENT_ENTITY_ADDRESS', 'PARENT_ENTITY_NAME'],
  ['SUBSCRIPTION_DATE', 'PARENT_ENTITY_ADDRESS'],
  ['SUBSCRIBER_FULL_NAME', 'SUBSCRIPTION_DATE'],
  ['SUBSCRIBER_FATHER_NAME', 'SUBSCRIBER_FULL_NAME'],
  ['SUBSCRIBER_ADDRESS', 'SUBSCRIBER_FATHER_NAME'],
  ['SUBSCRIBER_DOB', 'SUBSCRIBER_ADDRESS'],
  ['SUBSCRIBER_OCCUPATION', 'SUBSCRIBER_DOB'],
  ['SUBSCRIBER_NATIONALITY', 'SUBSCRIBER_OCCUPATION'],
  ['EQUITY_SHARES_SUBSCRIBED', 'SUBSCRIBER_NATIONALITY'],
];

function addWitnessToCell(row) {
  return row.replace(PARA_RE, (p) => {
    if (textOf(p).trim() !== 'Signed before Me') return p;
    return `${p}${WITNESS_CELL.map((text) => paragraphLike(p, text)).join('')}`;
  });
}

editDocx('moa-aoa-subscription-sheet-foreign.docx', (xml) => {
  if (xml.includes('{TOTAL_SHARES_TAKEN}')) return null;
  const rows = xml.match(ROW_RE);
  if (!rows || rows.length !== 5) throw new Error('foreign sheet: expected 5 table rows');
  const [, moaRow, totalRow, , aoaRow] = rows;

  let fixedAoa = aoaRow;
  for (const [from] of PAGE2_SHIFT) fixedAoa = fixedAoa.replace(`{${from}}`, `{@@${from}}`);
  for (const [from, to] of PAGE2_SHIFT) fixedAoa = fixedAoa.replace(`{@@${from}}`, `{${to}}`);

  let next = xml;
  next = next.replace(moaRow, addWitnessToCell(moaRow));
  next = next.replace(totalRow, mustReplace(totalRow, '{PARENT_ENTITY_NAME}', '{TOTAL_SHARES_TAKEN}', 'total row'));
  next = next.replace(aoaRow, addWitnessToCell(fixedAoa));
  return tagWitnessStatement(next);
});

// ---------------------------------------------------------------------------
// Resident (individual) sheet, from the firm's sample
// ---------------------------------------------------------------------------

const SAMPLE_WORDS = ['Naga', 'Ravanam', 'Aloha', 'Amalapuram', 'MITHILESH', 'SANNAREDDY', 'Suite 5'];

function tagSubscriberRow(row, { withShares }) {
  let addressSeen = false;
  let next = mapParagraphs(row, (p, raw) => {
    const t = raw.trim();
    if (t === '1.') return retext(p, [[0, '{#SUBSCRIBERS}{SL_NO}.']]);
    if (t.startsWith('Name:')) return retext(p, [[0, 'Name: '], ['value', '{SUBSCRIBER_FULL_NAME}']]);
    if (t.startsWith('(Nominee Shareholder of')) {
      return retext(p, [[0, '{#NOMINEE_OF}(Nominee Shareholder of {NOMINEE_OF}){/NOMINEE_OF}']]);
    }
    if (t.startsWith('S/o:')) return retext(p, [[0, '{SUBSCRIBER_RELATION}: '], ['value', '{SUBSCRIBER_FATHER_NAME}']]);
    if (t.startsWith('Address: C/')) {
      addressSeen = true;
      return retext(p, [[0, 'Address: '], ['value', '{SUBSCRIBER_ADDRESS}']]);
    }
    // The sample's address wraps onto continuation paragraphs on page 2.
    if (addressSeen && /Amalapuram|Pradesh, 533201/.test(t)) return null;
    if (t.startsWith('DOB:')) {
      addressSeen = false;
      return retext(p, [[0, 'DOB: '], ['value', '{SUBSCRIBER_DOB}']]);
    }
    if (t.startsWith('Occupation:') && !t.includes('Accountant')) {
      return retext(p, [[0, 'Occupation: '], ['value', '{SUBSCRIBER_OCCUPATION}']]);
    }
    if (t.startsWith('Nationality:')) return retext(p, [[0, 'Nationality: '], ['value', '{SUBSCRIBER_NATIONALITY}']]);
    if (withShares && t === '1') return retext(p, [[0, '{EQUITY_SHARES_SUBSCRIBED}']]);
    if (withShares && t === '(One)') return null;
    if (t === 'MITHILESH SAI SANNAREDDY') return retext(p, [[0, '{WITNESS_NAME}']]);
    if (t.startsWith('Address: Suite 5')) {
      return [
        retext(p, [[0, 'Address: '], ['value', '{WITNESS_ADDRESS}']]),
        paragraphLike(p, 'Occupation: {WITNESS_OCCUPATION}'),
        paragraphLike(p, '{WITNESS_MEMBERSHIP}{/SUBSCRIBERS}'),
      ].join('');
    }
    return p;
  });
  if (!next.includes('{#SUBSCRIBERS}') || !next.includes('{/SUBSCRIBERS}')) {
    throw new Error('resident sheet: subscriber row loop not placed');
  }
  return next;
}

editDocx(
  'moa-aoa-subscription-sheet-resident.docx',
  (xml) => {
    const rows = xml.match(ROW_RE);
    if (!rows || rows.length !== 5) throw new Error('resident sheet: expected 5 table rows');
    const [, moaRow, totalRow, , aoaRow] = rows;
    let next = xml;
    next = next.replace(moaRow, tagSubscriberRow(moaRow, { withShares: true }));
    next = next.replace(
      totalRow,
      mapParagraphs(totalRow, (p, t) => {
        if (t.trim() === '1') return retext(p, [[0, '{TOTAL_SHARES_TAKEN}']]);
        if (t.trim() === '(One)') return null;
        return p;
      }),
    );
    next = next.replace(aoaRow, tagSubscriberRow(aoaRow, { withShares: false }));
    next = tagWitnessStatement(next);
    const left = SAMPLE_WORDS.filter((w) => textOf(next).includes(w));
    if (left.length) throw new Error(`resident sheet: sample data left: ${left.join(', ')}`);
    return next;
  },
  { source: 'MOA & AOA Subcription Sheets Resident.docx' },
);
