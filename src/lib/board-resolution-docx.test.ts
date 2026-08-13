import fs from 'fs';
import path from 'path';

import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

import { dedupeXmlAttributes } from '@/lib/board-resolution-docx-body';
import { DEFAULT_NIC_CODES } from '@/lib/board-resolution';
import {
  patchBoardResolutionDocxBuffer,
  renderBoardResolutionDocxBuffer,
  sanitizeBoardResolutionDocxBuffer,
} from '@/lib/board-resolution-docx';

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

describe('board resolution template certification block', () => {
  it('lists Date on its own line with Place on the line below', () => {
    const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');
    if (!fs.existsSync(templatePath)) return;

    const xml = boardResolutionDocumentXml(fs.readFileSync(templatePath));
    expect(xml.indexOf('{CERTIFICATION_DATE}')).toBeGreaterThan(-1);
    expect(xml.indexOf('{CERTIFICATION_PLACE}')).toBeGreaterThan(-1);
    expect(xml.indexOf('{CERTIFICATION_DATE}')).toBeLessThan(xml.indexOf('{CERTIFICATION_PLACE}'));

    const certParas = xml
      .split('</w:p>')
      .filter((para) => /\{CERTIFICATION_(DATE|PLACE)\}/.test(para))
      .map((para) =>
        [...para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
          .map((match) => match[1])
          .join(''),
      );
    expect(certParas).toHaveLength(2);
    expect(certParas[0]).toMatch(/^Date:\s*\{CERTIFICATION_DATE\}/);
    expect(certParas[1]).toMatch(/^Place:\s*\{CERTIFICATION_PLACE\}/);
  });

  it('renders certification date before place in generated docx', () => {
    const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');
    if (!fs.existsSync(templatePath)) return;

    const docx = renderBoardResolutionDocxBuffer({
      pre1: {
        boardResolutionDate: '2026-05-26',
        parentEntityAddress: '123 Main St, Denver, USA',
      },
    });
    const text = docxPlainText(docx);
    const dateIdx = text.search(/Date:\s*\d/);
    const placeIdx = text.search(/Place:\s*\S/);
    expect(dateIdx).toBeGreaterThan(-1);
    expect(placeIdx).toBeGreaterThan(dateIdx);
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
