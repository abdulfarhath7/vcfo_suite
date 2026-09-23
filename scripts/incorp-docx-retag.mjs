/**
 * One-off, idempotent re-tagging of incorporation templates in place.
 *
 * - DIR-8: the prior-directorship row becomes a docxtemplater row loop over
 *   `PRIOR_DIRECTORSHIPS` (cell tags keep their names as item properties).
 * - DIR-8 / PAN undertaking: the literal "son of" becomes `{RELATION_OF}`, so
 *   the generator can print "daughter of" for a female director.
 *
 * Usage: node scripts/incorp-docx-retag.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const TEMPLATES = path.join(process.cwd(), 'public/templates');

const EDITS = {
  'dir-8.docx': [
    ['>{PRIOR_DIR_COMPANY}<', '>{#PRIOR_DIRECTORSHIPS}{PRIOR_DIR_COMPANY}<'],
    ['>{PRIOR_DIR_TO}<', '>{PRIOR_DIR_TO}{/PRIOR_DIRECTORSHIPS}<'],
    ['>son of <', '>{RELATION_OF} <'],
  ],
  'pan-undertaking.docx': [['>, Son of <', '>, {RELATION_OF} <']],
};

for (const [file, edits] of Object.entries(EDITS)) {
  const full = path.join(TEMPLATES, file);
  const zip = new PizZip(fs.readFileSync(full));
  let xml = zip.file('word/document.xml').asText();
  let changed = false;
  for (const [from, to] of edits) {
    if (xml.includes(to)) continue;
    if (!xml.includes(from)) throw new Error(`${file}: expected run ${from} not found`);
    xml = xml.replace(from, to);
    changed = true;
  }
  if (!changed) {
    console.log(`${file}: already tagged`);
    continue;
  }
  zip.file('word/document.xml', xml);
  fs.writeFileSync(full, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`${file}: re-tagged`);
}
