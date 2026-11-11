import fs from 'fs';
import path from 'path';

import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

import { dedupeXmlAttributes } from '@/lib/board-resolution/board-resolution-docx-body';
import { DEFAULT_NIC_CODES } from '@/lib/board-resolution/board-resolution';
import {
  patchBoardResolutionDocxBuffer,
  renderBoardResolutionDocxBuffer,
  sanitizeBoardResolutionDocxBuffer,
} from '@/lib/board-resolution/board-resolution-docx';

function boardResolutionDocumentXml(docx: Buffer): string {
  return new PizZip(docx).file('word/document.xml')?.asText() ?? '';
}

function docxPlainText(docx: Buffer): string {
  return boardResolutionDocumentXml(docx)
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^/]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDuplicateAttrs(xml: string): number {
  let count = 0;
  xml.replace(/<([^\s>/]+)((?:\s[^>]*?)*)>/g, (_full, _tagName, attrPart) => {
    const seen = new Set<string>();
    attrPart.replace(/\s([^\s=]+)(?:="[^"]*"|='[^']*'|=\S+)/g, (_match, name: string) => {
      const key = name.toLowerCase();
      if (seen.has(key)) count += 1;
      seen.add(key);
      return _match;
    });
    return _full;
  });
  return count;
}

function docxWithDocumentXml(documentXml: string): Buffer {
  const zip = new PizZip();
  zip.file('word/document.xml', documentXml);
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types/>');
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

/** Each Word paragraph's text, in document order (table cells included), as the editor reads it. */
function paragraphTexts(xml: string): string[] {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((m) =>
    [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(''),
  );
}

/** Each paragraph as the editor saves it: bold runs inside `<strong>`. */
function editorLines(xml: string): string[] {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((m) =>
    [...m[0].matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)]
      .map((r) => {
        const text = r[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/)?.[1] ?? '';
        return text && /<w:b\/>/.test(r[0]) ? `<strong>${text}</strong>` : text;
      })
      .join(''),
  );
}

/** The signature block: from the "For and on behalf of" paragraph to the end of the body. */
function signatureBlock(xml: string): string {
  const anchor = xml.lastIndexOf('For and on behalf of');
  const opens = [...xml.slice(0, anchor).matchAll(/<w:p(?:\s[^>]*)?>/g)];
  return xml.slice(opens[opens.length - 1]!.index, xml.lastIndexOf('<w:sectPr'));
}

/** Text runs of the block as "text|bold", with the font and size of each. */
function blockRuns(block: string): Array<{ text: string; bold: boolean; font: string; size: string }> {
  return [...block.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)]
    .map((m) => m[0])
    .filter((run) => /<w:t[\s>]/.test(run))
    .map((run) => ({
      text: run.match(/<w:t[^>]*>([^<]*)<\/w:t>/)?.[1] ?? '',
      bold: /<w:b\/>/.test(run),
      font: run.match(/w:ascii="([^"]*)"/)?.[1] ?? '',
      size: run.match(/<w:sz w:val="(\d+)"/)?.[1] ?? '',
    }));
}

const SIGNATURE_TEMPLATES = ['boardResolution.docx', 'boardResolution-indian-investing.docx'];

/** Part 3 of the owner's 10 Nov list: the signature block is aligned. */
describe.each(SIGNATURE_TEMPLATES)('board resolution signature block in %s', (name) => {
  const templatePath = path.join(process.cwd(), 'public/templates', name);
  const xml = fs.existsSync(templatePath) ? boardResolutionDocumentXml(fs.readFileSync(templatePath)) : '';

  it('uses the body font for every label and value, bold only where the template means it', () => {
    if (!xml) return;
    const runs = blockRuns(signatureBlock(xml));
    expect(runs.map((r) => r.text)).toEqual([
      'For and on behalf of ',
      '{PARENT_ENTITY_NAME}',
      'Authorised Person',
      '{SIGNATORY_NAME}',
      'Designation:',
      '{SIGNATORY_DESIGNATION}',
      'Date:',
      '{CERTIFICATION_DATE}',
      'Place:',
      '{CERTIFICATION_PLACE}',
    ]);
    for (const run of runs) expect([run.font, run.size]).toEqual(['Times New Roman', '22']);
    expect(runs.filter((r) => r.bold).map((r) => r.text)).toEqual([
      '{PARENT_ENTITY_NAME}',
      'Authorised Person',
      '{SIGNATORY_NAME}',
      'Date:',
      'Place:',
    ]);
  });

  it('starts the Designation, Date and Place values at one position', () => {
    if (!xml) return;
    const block = signatureBlock(xml);
    const table = block.match(/<w:tbl>[\s\S]*<\/w:tbl>/)?.[0] ?? '';
    const rows = [...table.matchAll(/<w:tr>[\s\S]*?<\/w:tr>/g)].map((row) => paragraphTexts(row[0]));
    expect(rows).toEqual([
      ['Designation:', '{SIGNATORY_DESIGNATION}'],
      ['Date:', '{CERTIFICATION_DATE}'],
      ['Place:', '{CERTIFICATION_PLACE}'],
    ]);
    // One label column for every row, no borders and no cell padding to shift the text.
    expect([...table.matchAll(/<w:tcW w:w="(\d+)"/g)].map((m) => m[1]).filter((_, i) => i % 2 === 0)).toEqual(['1440', '1440', '1440']);
    expect(table).toMatch(/<w:tblBorders>(?:<w:\w+ w:val="nil"\/>){6}<\/w:tblBorders>/);
    expect(table).toContain('<w:left w:w="0" w:type="dxa"/>');
    // No tab, line break or run of spaces lines anything up.
    expect(table).not.toMatch(/<w:tab\/>|<w:br\/>/);
  });

  it('spaces the lines evenly: one paragraph per line, no empty lines, no space after', () => {
    if (!xml) return;
    const block = signatureBlock(xml);
    const texts = paragraphTexts(block);
    // The last paragraph is the 1 pt one Word keeps after a table.
    expect(texts.slice(0, -1).every((t) => t.trim() !== '')).toBe(true);
    expect(texts.at(-1)).toBe('');
    const spacings = [...block.matchAll(/<w:p(?:\s[^>]*)?><w:pPr><w:spacing ([^/]*)\/>/g)].map((m) => m[1]);
    expect(new Set(spacings.slice(0, -1).map((s) => s.trim()))).toEqual(new Set(['w:before="0" w:after="0"']));
    // Only the first line keeps the blank lines above it, for the signature.
    expect(block.slice(block.indexOf('</w:p>')).includes('<w:br/>')).toBe(false);
  });
});

describe('board resolution signature block in a generated Word file', () => {
  const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');

  it('fills each value in its own cell, date before place', () => {
    if (!fs.existsSync(templatePath)) return;
    const docx = renderBoardResolutionDocxBuffer({
      pre1: { boardResolutionDate: '2026-05-26', parentEntityAddress: '123 Main St, Denver, USA' },
      overrides: { SIGNATORY_NAME: 'Hasan Askari', SIGNATORY_DESIGNATION: 'Director', CERTIFICATION_PLACE: 'United States of America' },
    });
    const texts = paragraphTexts(signatureBlock(boardResolutionDocumentXml(docx)));
    expect(texts.slice(1, 9)).toEqual([
      'Authorised Person',
      'Hasan Askari',
      'Designation:',
      'Director',
      'Date:',
      expect.stringMatching(/\d/),
      'Place:',
      'United States of America',
    ]);
  });

  it('keeps the layout when the editor saves the document', () => {
    if (!fs.existsSync(templatePath)) return;
    const docx = renderBoardResolutionDocxBuffer({
      overrides: { SIGNATORY_NAME: 'Hasan Askari', CERTIFICATION_PLACE: 'United States of America' },
    });
    // The editor saves one line per Word paragraph; change the Place value only.
    const lines = editorLines(boardResolutionDocumentXml(docx)).map((t) => (t === 'United States of America' ? 'New York' : t));
    const patched = boardResolutionDocumentXml(patchBoardResolutionDocxBuffer(docx, lines.join('\n')));
    const block = signatureBlock(patched);
    expect(block).toContain('<w:tbl>');
    expect(paragraphTexts(block).slice(-3, -1)).toEqual(['Place:', 'New York']);
    expect(blockRuns(block).find((r) => r.text === 'Place:')?.bold).toBe(true);
    expect(blockRuns(block).find((r) => r.text === 'New York')).toMatchObject({ bold: false, font: 'Times New Roman', size: '22' });
  });
});

describe('board resolution template NIC codes', () => {
  it('has one {NIC_CODES} placeholder and no sample NIC literals in document.xml', () => {
    const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');
    if (!fs.existsSync(templatePath)) return;

    const xml = boardResolutionDocumentXml(fs.readFileSync(templatePath));
    expect([...xml.matchAll(/\{NIC_CODES\}/g)].length).toBe(1);
    expect(xml).not.toMatch(/<w:t[^>]*>\s*62099/);
  });

  it('renders merged NIC codes once in the NIC clause', () => {
    const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');
    if (!fs.existsSync(templatePath)) return;

    const docx = renderBoardResolutionDocxBuffer({
      pre1: { nicCodes: DEFAULT_NIC_CODES },
    });
    const text = docxPlainText(docx);
    const nicIdx = text.indexOf('NIC) codes');
    expect(nicIdx).toBeGreaterThan(-1);

    const nicClause = text.slice(nicIdx, nicIdx + 700);
    expect(nicClause.split('62099').length - 1).toBe(1);
    expect(nicClause.split('62020').length - 1).toBe(1);
  });
});

describe('sanitizeBoardResolutionDocxBuffer', () => {
  it('removes duplicate xml:space attributes from document.xml', () => {
    const corruptXml =
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:t xml:space="preserve" xml:space="preserve">Hello </w:t></w:r></w:p></w:body></w:document>';
    const docx = docxWithDocumentXml(corruptXml);
    const cleaned = sanitizeBoardResolutionDocxBuffer(docx);
    const zip = new PizZip(cleaned);
    const xml = zip.file('word/document.xml')?.asText() ?? '';
    expect(findDuplicateAttrs(xml)).toBe(0);
    expect((xml.match(/xml:space="preserve"/g) ?? []).length).toBe(1);
  });
});

describe('patchBoardResolutionDocxBuffer', () => {
  it('produces valid XML for bold and alignment patches', () => {
    const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');
    if (!fs.existsSync(templatePath)) return;

    const templateBuf = fs.readFileSync(templatePath);
    const structured = JSON.stringify({
      br: 1,
      paragraphs: [
        { text: 'RESOLVED THAT', line: '<strong>RESOLVED THAT</strong>', align: 'center' },
        { text: 'Second line bold', line: 'Second line <strong>bold</strong>', align: 'right' },
      ],
    });

    const patched = patchBoardResolutionDocxBuffer(templateBuf, structured);
    const xml = new PizZip(patched).file('word/document.xml')?.asText() ?? '';

    expect(xml).not.toMatch(/xml:space="preserve"[^>]*xml:space="preserve"/);
    expect(findDuplicateAttrs(xml)).toBe(0);
  });
});

describe('dedupeXmlAttributes', () => {
  it('dedupes repeated names case-insensitively', () => {
    const input = '<w:t xml:space="preserve" XML:space="preserve">x</w:t>';
    const output = dedupeXmlAttributes(input);
    expect((output.match(/xml:space/gi) ?? []).length).toBe(1);
  });
});
