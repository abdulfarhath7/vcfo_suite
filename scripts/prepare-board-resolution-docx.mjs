#!/usr/bin/env node
/**
 * Build `public/templates/boardResolution.docx` from the firm's Word file.
 *
 *   node scripts/prepare-board-resolution-docx.mjs "<path to BR Name approval.docx>"
 *
 * The firm marks every blank ("_____") with a Word comment naming what goes
 * there. This script swaps each commented blank for its docxtemplater tag,
 * turns the director bullets into one looped bullet, and drops the comments,
 * so the firm's layout, fonts and numbering are kept as-is.
 *
 * Comment order in the source (id → tag) is the contract below. If the firm
 * edits the Word file, re-check the ids with `unzip -p <file> word/comments.xml`.
 */
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const [, , source] = process.argv;
if (!source) {
  console.error('usage: node scripts/prepare-board-resolution-docx.mjs <source.docx>');
  process.exit(1);
}
const OUT = path.join(process.cwd(), 'public/templates/boardResolution.docx');

/** Comment id → replacement text for the blank it covers ('' = drop the blank). */
const TAGS = {
  0: '{PARENT_ENTITY_NAME} ',
  1: '{RESOLUTION_EFFECTIVE_DATE}',
  // A parent in a country without states drops the "State of" phrase.
  2: '{PARENT_JURISDICTION}{#PARENT_STATE}, the State of {PARENT_STATE}{/PARENT_STATE}',
  3: '{PARENT_ENTITY_NAME}',
  // "A and B" or just "A": the joining " and " is removed below.
  4: '{PROPOSED_NAMES}',
  5: '',
  // One clause with code and description; the " n.e.c, &" between the blanks is removed below.
  6: '{NIC_CODES}',
  7: '',
  // Figures and "(Indian Rupees … Only)" come as one value.
  8: '{AUTHORISED_CAPITAL}',
  9: '',
  // id 10 is anchored on the word "be" — keep the word.
  11: 'INR {PAID_UP_CAPITAL}',
  12: '{PARENT_ENTITY_NAME}',
  15: '{PARENT_ENTITY_NAME}',
  // The firm puts the name on the line under "Authorised Person".
  16: '{SIGNATORY_NAME}',
  17: ': {SIGNATORY_DESIGNATION}',
  18: '{CERTIFICATION_DATE}',
};
/** The two director bullets: the first becomes the loop, the second is removed. */
const DIRECTOR_LOOP_ID = 13;
const DIRECTOR_DROP_ID = 14;

const zip = new PizZip(fs.readFileSync(source));
let xml = zip.file('word/document.xml').asText();

/** Replace the text of every <w:t> between a comment's start and end: first gets `text`, rest emptied. */
function tagComment(id, text) {
  const start = xml.indexOf(`<w:commentRangeStart w:id="${id}"/>`);
  const end = xml.indexOf(`<w:commentRangeEnd w:id="${id}"/>`);
  if (start < 0 || end < 0) throw new Error(`comment ${id} not found`);
  let first = true;
  const inner = xml.slice(start, end).replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (_, open, _t, close) => {
    const value = first ? text : '';
    first = false;
    return `<w:t xml:space="preserve">${value}${close}`;
  });
  xml = xml.slice(0, start) + inner + xml.slice(end);
}

/** The paragraph (<w:p>…</w:p>) holding comment `id`. */
function paragraphOf(id) {
  const at = xml.indexOf(`<w:commentRangeStart w:id="${id}"/>`);
  const start = Math.max(xml.lastIndexOf('<w:p>', at), xml.lastIndexOf('<w:p ', at));
  const end = xml.indexOf('</w:p>', at) + '</w:p>'.length;
  return { start, end };
}

/** Empty every <w:t> between the end of comment `a` and the start of comment `b` (the joining text). */
function clearBetween(a, b) {
  const from = xml.indexOf(`<w:commentRangeEnd w:id="${a}"/>`);
  const to = xml.indexOf(`<w:commentRangeStart w:id="${b}"/>`);
  if (from < 0 || to < from) throw new Error(`comments ${a}..${b} not found in order`);
  const inner = xml.slice(from, to).replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, '$1$3');
  xml = xml.slice(0, from) + inner + xml.slice(to);
}

for (const [id, text] of Object.entries(TAGS)) tagComment(Number(id), text);

// Some blanks run past their comment (split across runs); every blank is tagged by now.
xml = xml.replace(/(<w:t(?: [^>]*)?>)_+(<\/w:t>)/g, '$1$2').replace(/(<w:t(?: [^>]*)?>)([^<_]*?)_{3,}([^<]*<\/w:t>)/g, '$1$2$3');

// "laws of the Singapore" reads wrong; the jurisdiction value carries its own article when needed.
xml = xml.replace(/laws of the\s*<\/w:t>/, 'laws of </w:t>');
clearBetween(4, 5);
clearBetween(6, 7);

// Directors: one bullet repeated per director.
{
  const drop = paragraphOf(DIRECTOR_DROP_ID);
  xml = xml.slice(0, drop.start) + xml.slice(drop.end);
  const loop = paragraphOf(DIRECTOR_LOOP_ID);
  let first = true;
  const bullet = xml
    .slice(loop.start, loop.end)
    .replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (_, _open, _t, close) => {
      const value = first ? '{NAME}' : '';
      first = false;
      return `<w:t xml:space="preserve">${value}${close}`;
    });
  const marker = (tag) => `<w:p><w:r><w:t>${tag}</w:t></w:r></w:p>`;
  xml = xml.slice(0, loop.start) + marker('{#DIRECTORS}') + bullet + marker('{/DIRECTORS}') + xml.slice(loop.end);
}

// Place was typed as "USA".
xml = xml.replace(/(Place:[\s\S]*?<w:t(?: [^>]*)?>)\s*USA\s*(<\/w:t>)/, '$1{CERTIFICATION_PLACE}$2');
if (!xml.includes('{CERTIFICATION_PLACE}')) throw new Error('Place: USA not found');

// Drop the comments: anchors, reference runs, and the comment parts.
xml = xml
  .replace(/<w:commentRange(?:Start|End) w:id="\d+"\/>/g, '')
  .replace(/<w:r(?: [^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<w:commentReference w:id="\d+"\/><\/w:r>/g, '');
// Yellow marks the blanks for whoever fills them by hand; a generated draft has none.
xml = xml.replace(/<w:highlight w:val="[a-zA-Z]+"\/>/g, '');
zip.file('word/document.xml', xml);

for (const name of Object.keys(zip.files)) {
  if (/^word\/(comments[A-Za-z]*|people)\.xml$/.test(name)) zip.remove(name);
}
const rels = zip.file('word/_rels/document.xml.rels').asText();
zip.file(
  'word/_rels/document.xml.rels',
  rels.replace(/<Relationship [^>]*Target="(?:comments[A-Za-z]*|people)\.xml"\/>/g, ''),
);
const types = zip.file('[Content_Types].xml').asText();
zip.file(
  '[Content_Types].xml',
  types.replace(/<Override PartName="\/word\/(?:comments[A-Za-z]*|people)\.xml"[^>]*\/>/g, ''),
);

// The header's "{On the letter head…}" braces would read as a template tag.
for (const name of Object.keys(zip.files)) {
  if (/^word\/header\d*\.xml$/.test(name)) {
    const header = zip.file(name).asText();
    zip.file(name, header.replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (_, o, t, c) => o + t.replace(/[{}]/g, '') + c));
  }
}

const leftover = (xml.match(/<w:t(?: [^>]*)?>[^<]*_{3,}[^<]*<\/w:t>/g) ?? []).length;
if (leftover) throw new Error(`${leftover} blank(s) left untagged`);

fs.writeFileSync(OUT, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`wrote ${OUT}`);
