#!/usr/bin/env node
/**
 * Build `public/templates/boardResolution.docx` from the firm's Word file.
 *
 *   node scripts/prepare-board-resolution-docx.mjs "<path to BR Name approval.docx>"
 *
 * The firm marks every blank ("_____") with a Word comment naming what goes
 * there; `scripts/docx-comment-tags.mjs` swaps each for its docxtemplater tag.
 *
 * Comment order in the source (id → tag) is the contract below. If the firm
 * edits the Word file, re-check the ids with `unzip -p <file> word/comments.xml`.
 */
import path from 'node:path';
import { tagCommentedDocx } from './docx-comment-tags.mjs';

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

tagCommentedDocx({
  source,
  out: OUT,
  tags: TAGS,
  clearBetween: [
    [4, 5],
    [6, 7],
  ],
  directors: { loop: DIRECTOR_LOOP_ID, drop: DIRECTOR_DROP_ID },
  afterCleanup(xml) {
    // "laws of the Singapore" reads wrong; the jurisdiction value carries its own article when needed.
    xml = xml.replace(/laws of the\s*<\/w:t>/, 'laws of </w:t>');
    // Place was typed as "USA".
    xml = xml.replace(/(Place:[\s\S]*?<w:t(?: [^>]*)?>)\s*USA\s*(<\/w:t>)/, '$1{CERTIFICATION_PLACE}$2');
    if (!xml.includes('{CERTIFICATION_PLACE}')) throw new Error('Place: USA not found');
    return xml;
  },
});
