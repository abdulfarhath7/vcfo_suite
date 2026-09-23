/**
 * Builds the two declaration templates from inc-9.docx (same page, styles,
 * fonts and border), replacing only the body. Idempotent: re-running
 * overwrites the two outputs.
 *
 *   public/templates/id-address-declaration.docx
 *   public/templates/deposit-declaration.docx
 *
 * Usage: node scripts/incorp-docx-build-declarations.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const TEMPLATES = path.join(process.cwd(), 'public/templates');
const SOURCE = path.join(TEMPLATES, 'inc-9.docx');

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function para(text, { align = 'both', bold = false, italic = false } = {}) {
  const rPr =
    '<w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>' +
    (bold ? '<w:b/><w:bCs/>' : '') +
    (italic ? '<w:i/><w:iCs/>' : '') +
    '<w:sz w:val="22"/><w:szCs w:val="22"/>';
  const run = text ? `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r>` : '';
  return (
    `<w:p><w:pPr><w:pStyle w:val="Default"/><w:spacing w:line="276" w:lineRule="auto"/>` +
    `<w:jc w:val="${align}"/><w:rPr>${rPr}</w:rPr></w:pPr>${run}</w:p>`
  );
}

const blank = () => para('');

function signatureBlock(extra = []) {
  return [
    blank(),
    blank(),
    para('__________________________', { bold: true }),
    para('{DIRECTOR_FULL_NAME}', { bold: true }),
    para('DIN: {DIRECTOR_DIN}'),
    ...extra,
    blank(),
    para('Place: {DOCUMENT_PLACE}', { bold: true }),
    para('Date: {DOCUMENT_DATE}', { bold: true }),
  ];
}

const DOCS = {
  'id-address-declaration.docx': [
    para('ID & Address Declaration', { align: 'center', bold: true }),
    para('[Rule 16(1)(m) — Companies (Incorporation) Rules, 2014]', { align: 'center', italic: true }),
    blank(),
    blank(),
    para(
      'I, {DIRECTOR_FULL_NAME}, {RELATION_PREFIX} {FATHERS_NAME}, residing at {DIRECTOR_ADDRESS}, ' +
        'proposed to be appointed as First Director of {PROPOSED_COMPANY_NAME} (“Proposed Company”) ' +
        'hereby declare, pursuant to explanation provided under rule 16(1)(m) of the Companies ' +
        '(Incorporation) Rules, 2014, that the identity details and residence address (Present and ' +
        'Permanent) as mentioned in SPICe+ Form are the same as mentioned in the DIN details as on the ' +
        'date of application.',
    ),
    ...signatureBlock(),
  ],
  'deposit-declaration.docx': [
    para('Deposit Declaration', { align: 'center', bold: true }),
    blank(),
    blank(),
    para(
      'I, {DIRECTOR_FULL_NAME}, {RELATION_PREFIX} {FATHERS_NAME}, residing at {DIRECTOR_ADDRESS}, ' +
        'being a First Director as mentioned in the Articles of Association of {PROPOSED_COMPANY_NAME} ' +
        '(“Proposed Company”) under the process of Incorporation, declare that:',
    ),
    blank(),
    para(
      '1. All the requirements of the Companies Act, 2013 and the rules made thereunder relating to ' +
        'incorporation of the company under the Act and matters precedent or incidental thereto have ' +
        'been complied with.',
    ),
    blank(),
    para(
      '2. The Company will not accept deposits unless in compliance with the applicable provisions of ' +
        'the Companies Act, 2013, RBI Act, 1934, and SEBI Act, 1992, and rules/directions/regulations ' +
        'made thereunder and the necessary documents/information(s) are filed with the Concerned ' +
        'Authorities.',
    ),
    blank(),
    para('Yours faithfully,'),
    ...signatureBlock([
      para(
        '(FIRST DIRECTOR NAMED IN THE ARTICLES OF ASSOCIATION OF {PROPOSED_COMPANY_NAME} — PROPOSED)',
      ),
    ]),
  ],
};

const source = fs.readFileSync(SOURCE);
for (const [file, paragraphs] of Object.entries(DOCS)) {
  const zip = new PizZip(source);
  const xml = zip.file('word/document.xml').asText();
  const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
  const sectStart = xml.lastIndexOf('<w:sectPr');
  const next = xml.slice(0, bodyStart) + paragraphs.join('') + xml.slice(sectStart);
  zip.file('word/document.xml', next);
  fs.writeFileSync(path.join(TEMPLATES, file), zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`${file}: written`);
}
