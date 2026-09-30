#!/usr/bin/env node
/**
 * Build the tagged Pre-2 templates for an Indian parent company from the
 * firm's blank Word files, which stay as supplied in `public/templates/`:
 *
 *   noc-indian-investing.docx  → boardResolution-indian-investing.docx
 *   noc-indian-name-only.docx  → boardResolution-indian-name-only.docx
 *
 *   node scripts/prepare-noc-board-resolution-docx.mjs
 *
 * Comment order in each source (id → tag) is the contract below. If the firm
 * edits a Word file, re-check the ids with `unzip -p <file> word/comments.xml`.
 */
import path from 'node:path';
import { tagCommentedDocx } from './docx-comment-tags.mjs';

const dir = path.join(process.cwd(), 'public/templates');

/** The Place blank has no comment; tag it before the blanks are cleared. */
function tagPlace(xml) {
  const tagged = xml.replace(/(Place:[\s\S]*?<w:t(?: [^>]*)?>)_+(<\/w:t>)/, '$1{CERTIFICATION_PLACE}$2');
  if (!tagged.includes('{CERTIFICATION_PLACE}')) throw new Error('Place blank not found');
  return tagged;
}

// Same resolution as the foreign one, under the Companies Act 2013.
tagCommentedDocx({
  source: path.join(dir, 'noc-indian-investing.docx'),
  out: path.join(dir, 'boardResolution-indian-investing.docx'),
  tags: {
    0: '{PARENT_ENTITY_NAME} ',
    1: '{RESOLUTION_EFFECTIVE_DATE}',
    2: '{PARENT_ENTITY_NAME}',
    // "A and B" or just "A": the joining " and " is removed below.
    3: '{PROPOSED_NAMES}',
    4: '',
    // One clause with code and description; the " n.e.c, &" between the blanks is removed below.
    5: '{NIC_CODES}',
    6: '',
    // Figures and "(Indian Rupees … Only)" come as one value.
    7: '{AUTHORISED_CAPITAL}',
    8: '',
    // id 9 is anchored on the word "be" — keep the word.
    10: 'INR {PAID_UP_CAPITAL}',
    11: '{PARENT_ENTITY_NAME}',
    14: '{PARENT_ENTITY_NAME}',
    15: '{SIGNATORY_NAME}',
    16: ': {SIGNATORY_DESIGNATION}',
    17: '{CERTIFICATION_DATE}',
  },
  clearBetween: [
    [3, 4],
    [5, 6],
  ],
  directors: { loop: 12, drop: 13 },
  beforeCleanup: tagPlace,
});

// The parent only lends a word of its name; nothing about capital or directors.
tagCommentedDocx({
  source: path.join(dir, 'noc-indian-name-only.docx'),
  out: path.join(dir, 'boardResolution-indian-name-only.docx'),
  tags: {
    0: '{PARENT_ENTITY_NAME}',
    1: '{RESOLUTION_EFFECTIVE_DATE}.',
    2: '{PARENT_ENTITY_NAME}',
    3: '{PROPOSED_NAME_1}',
    // `“A” or “B” or such other name` — a single proposed name drops the second.
    4: '{#PROPOSED_NAME_2}“{PROPOSED_NAME_2}” or {/PROPOSED_NAME_2}',
    5: '{PARENT_ENTITY_NAME}',
    6: '{SIGNATORY_NAME}',
    7: '{SIGNATORY_DIN}',
  },
  afterCleanup(xml) {
    // The firm's sample was typed for one client: the weekday, the name word and the signer's role.
    const out = xml
      .replace(/\bSATURDAY\b/g, '{RESOLUTION_DAY}')
      .replace(/\bSAMPADA\b/g, '{NAME_WORD}')
      .replace(/Designated Partner/, '{SIGNATORY_DESIGNATION}');
    for (const tag of ['{RESOLUTION_DAY}', '{NAME_WORD}', '{SIGNATORY_DESIGNATION}']) {
      if (!out.includes(tag)) throw new Error(`${tag} anchor not found`);
    }
    return out;
  },
});
