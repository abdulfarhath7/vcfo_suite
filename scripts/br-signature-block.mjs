#!/usr/bin/env node
/**
 * The signature block at the foot of the board resolution (part 3 of the owner's 10 Nov list).
 *
 *   For and on behalf of <Company>       the company name in bold
 *   Authorised Person                    bold
 *   <Signatory name>                     bold
 *   Designation:  <designation>          labels and values in a borderless two-column table,
 *   Date:         <date>                 so every value starts at the same position;
 *   Place:        <place>                "Date:" and "Place:" in bold
 *
 * The firm's Word files typed this block with spaces, a line break and an empty paragraph, so
 * the values started at different positions and the lines were spaced unevenly. Every line is
 * now its own paragraph in the body font (Times New Roman 11 pt) with no space after it. Each
 * label and value has its own paragraph because the editor saves one line per Word paragraph
 * and would lose a tab or a line break inside one.
 *
 * `alignSignatureBlock(xml)` rewrites word/document.xml; the prepare scripts call it, and
 *
 *   node scripts/br-signature-block.mjs
 *
 * applies it to the tagged templates already in public/templates. It is safe to run twice.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PizZip from 'pizzip';

const FONT = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';
const SIZE = '<w:sz w:val="22"/><w:szCs w:val="22"/>';
/** The label column: wide enough for "Designation:" and a clear gap after it. */
const LABEL_WIDTH = 1440;
/** The table's name in Word's accessibility pane. */
const CAPTION = 'Signature details';
const TAGS = ['{PARENT_ENTITY_NAME}', '{SIGNATORY_NAME}', '{SIGNATORY_DESIGNATION}', '{CERTIFICATION_DATE}', '{CERTIFICATION_PLACE}'];

const rPr = (bold) => `<w:rPr>${FONT}${bold ? '<w:b/><w:bCs/>' : ''}${SIZE}</w:rPr>`;
const run = (text, bold = false) => `<w:r>${rPr(bold)}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const breakRun = `<w:r>${rPr(false)}<w:br/></w:r>`;
const paragraph = (runs) =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="left"/>${rPr(false)}</w:pPr>${runs}</w:p>`;

const cell = (width, runs) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraph(runs)}</w:tc>`;

function detailsTable(textWidth) {
  const valueWidth = textWidth - LABEL_WIDTH;
  const none = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) => `<w:${side} w:val="nil"/>`).join('');
  const zero = ['top', 'left', 'bottom', 'right'].map((side) => `<w:${side} w:w="0" w:type="dxa"/>`).join('');
  const row = (label, bold, value) =>
    `<w:tr>${cell(LABEL_WIDTH, run(label, bold))}${cell(valueWidth, run(value))}</w:tr>`;
  return (
    '<w:tbl>' +
    `<w:tblPr><w:tblW w:w="${textWidth}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblBorders>${none}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar>${zero}</w:tblCellMar>` +
    '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>' +
    `<w:tblCaption w:val="${CAPTION}"/></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${LABEL_WIDTH}"/><w:gridCol w:w="${valueWidth}"/></w:tblGrid>` +
    row('Designation:', false, '{SIGNATORY_DESIGNATION}') +
    row('Date:', true, '{CERTIFICATION_DATE}') +
    row('Place:', true, '{CERTIFICATION_PLACE}') +
    '</w:tbl>'
  );
}

/** The width between the margins, from the body's section properties (twips). */
function textWidth(sectPr) {
  const page = Number(sectPr.match(/<w:pgSz [^>]*w:w="(\d+)"/)?.[1]);
  const left = Number(sectPr.match(/<w:pgMar [^>]*w:left="(\d+)"/)?.[1]);
  const right = Number(sectPr.match(/<w:pgMar [^>]*w:right="(\d+)"/)?.[1]);
  if (!page || Number.isNaN(left) || Number.isNaN(right)) throw new Error('page size or margins not found');
  return page - left - right;
}

/** Rewrite the signature block, from "For and on behalf of" to the end of the body. */
export function alignSignatureBlock(xml) {
  const sectStart = xml.lastIndexOf('<w:sectPr');
  const anchor = xml.lastIndexOf('For and on behalf of', sectStart);
  if (sectStart < 0 || anchor < 0) throw new Error('signature block not found');
  // The paragraph that holds the anchor: `<w:p>` or `<w:p …>`, never `<w:pPr>`.
  const opens = [...xml.slice(0, anchor).matchAll(/<w:p(?:\s[^>]*)?>/g)];
  const start = opens[opens.length - 1]?.index;
  if (start === undefined) throw new Error('signature paragraph not found');

  const block = xml.slice(start, sectStart);
  for (const tag of TAGS) {
    if (!block.includes(tag)) throw new Error(`${tag} missing from the signature block`);
  }
  // Keep the blank lines the firm left above "For and on behalf of" (space for the signature).
  const firstParagraph = block.slice(0, block.indexOf('</w:p>'));
  const breaks = (firstParagraph.slice(0, firstParagraph.indexOf('For and on behalf of')).match(/<w:br\/>/g) ?? []).length;

  const aligned =
    paragraph(breakRun.repeat(breaks) + run('For and on behalf of ') + run('{PARENT_ENTITY_NAME}', true)) +
    paragraph(run('Authorised Person', true)) +
    paragraph(run('{SIGNATORY_NAME}', true)) +
    detailsTable(textWidth(xml.slice(sectStart))) +
    // Word keeps a paragraph after a table at the end of the body; this one is 1 pt high.
    '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>';
  return xml.slice(0, start) + aligned + xml.slice(sectStart);
}

/** The tagged templates whose signature block has these labels (the name-only NOC has its own). */
export const SIGNATURE_BLOCK_TEMPLATES = ['boardResolution.docx', 'boardResolution-indian-investing.docx'];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.join(process.cwd(), 'public/templates');
  for (const name of SIGNATURE_BLOCK_TEMPLATES) {
    const file = path.join(dir, name);
    const zip = new PizZip(fs.readFileSync(file));
    zip.file('word/document.xml', alignSignatureBlock(zip.file('word/document.xml').asText()));
    fs.writeFileSync(file, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
    console.log(`aligned the signature block in ${name}`);
  }
}
