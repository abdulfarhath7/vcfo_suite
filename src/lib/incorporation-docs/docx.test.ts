import { DOMParser } from '@xmldom/xmldom';
import PizZip from 'pizzip';
import { describe, expect, it, vi } from 'vitest';

import { renderDir2DocxBuffer, renderIncorpDocxBuffer, renderPanUndertakingDocxBuffer, patchIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import {
  sanitizeIncorpDocxBuffer,
  sanitizeIncorpDocxBufferWithReport,
} from '@/lib/incorporation-docs/docx-sanitize';
import { assertIncorpDocxWordXmlValid } from '@/lib/incorporation-docs/docx-validate';
import { INCORP_DOC_KINDS } from '@/lib/incorporation-docs/types';

const pre6Base = {
  nrDirectorFirstName: 'Justin',
  nrDirectorMiddleName: 'Cheng',
  nrDirectorLastName: 'Hsu',
  nrDirectorDob: '1980-02-25',
  nrDirectorFatherName: 'Robert Hsu',
  nrDirectorPassportNumber: 'P2982018',
  nrDirectorUtilityBillAddress: '2544 Horsetail Road, Frisco, Texas 75033, USA',
  nrDirectorPersonalMailId: 'justin@example.com',
  nrDirectorMobileNumber: '+1 555 0100',
  residentDirectorFirstName: 'Priya',
  residentDirectorLastName: 'Sharma',
  residentDirectorDob: '1990-06-15',
  residentDirectorFatherName: 'Raj Sharma',
  residentDirectorUtilityBillAddress: '12 MG Road, Bengaluru, Karnataka 560001, India',
  residentDirectorPersonalMailId: 'priya@example.com',
  residentDirectorMobileNumber: '+91 9876543210',
  residentDirectorPanNumber: 'ABCDE1234F',
  residentDirectorUtilityBillType: 'electricity',
};

vi.mock('server-only', () => ({}));

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

function parseXmlOrError(xml: string): string | null {
  // Word writes a valid UTF-8 BOM on some templates; @xmldom miscounts it as
  // content and rejects the (valid) leading xml declaration. Strip it first so
  // this helper matches real XML validity (the production saxes validator, and
  // Word, both accept the BOM).
  const withoutBom = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  try {
    new DOMParser().parseFromString(withoutBom, 'application/xml');
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'XML parse failed';
  }
}

describe('sanitizeIncorpDocxBuffer', () => {
  it('removes duplicate xml:space attributes from document.xml', () => {
    const corruptXml =
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:t xml:space="preserve" xml:space="preserve">Hello </w:t></w:r></w:p></w:body></w:document>';
    const docx = docxWithDocumentXml(corruptXml);
    const cleaned = sanitizeIncorpDocxBuffer(docx);
    const zip = new PizZip(cleaned);
    const xml = zip.file('word/document.xml')?.asText() ?? '';
    expect(findDuplicateAttrs(xml)).toBe(0);
    expect((xml.match(/xml:space="preserve"/g) ?? []).length).toBe(1);
  });

  it('repairs duplicate attributes in non-document word XML parts', () => {
    const zip = new PizZip();
    zip.file(
      'word/document.xml',
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>',
    );
    zip.file(
      'word/header1.xml',
      '<?xml version="1.0"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t xml:space="preserve" xml:space="preserve"> Header </w:t></w:r></w:p></w:hdr>',
    );
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types/>');
    const docx = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;

    const result = sanitizeIncorpDocxBufferWithReport(docx);
    expect(result.changed).toBe(true);
    expect(result.repairedEntries).toContain('word/header1.xml');

    const repairedZip = new PizZip(result.buffer);
    const headerXml = repairedZip.file('word/header1.xml')?.asText() ?? '';
    expect(findDuplicateAttrs(headerXml)).toBe(0);
    expect((headerXml.match(/xml:space="preserve"/g) ?? []).length).toBe(1);
  });

  it('repairs malformed XML entries outside word/* and strips invalid control chars', () => {
    const zip = new PizZip();
    zip.file(
      'word/document.xml',
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Ok</w:t></w:r></w:p></w:body></w:document>',
    );
    // Duplicate attributes + invalid XML control character in a non-word XML part.
    zip.file(
      'docProps/core.xml',
      `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/" xml:space="preserve" xml:space="preserve">Bad${String.fromCharCode(0x1f)}</dc:title></cp:coreProperties>`,
    );
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types/>');
    const docx = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;

    const result = sanitizeIncorpDocxBufferWithReport(docx);
    expect(result.changed).toBe(true);
    expect(result.repairedEntries).toContain('docProps/core.xml');

    const repairedZip = new PizZip(result.buffer);
    const coreXml = repairedZip.file('docProps/core.xml')?.asText() ?? '';
    expect(findDuplicateAttrs(coreXml)).toBe(0);
    expect(coreXml.includes(String.fromCharCode(0x1f))).toBe(false);
    expect(parseXmlOrError(coreXml)).toBeNull();
  });
});

describe('renderInc9DocxBuffer', () => {
  it('produces parseable XML for resident director output', async () => {
    const { renderInc9DocxBuffer } = await import('@/lib/incorporation-docs/docx');
    const buffer = renderInc9DocxBuffer({
      director: 'resident',
      engagement: { companyName: 'ABC Track Private Limited' },
      pre1: { proposedName1: 'ABC Track Private Limited' },
      pre5: { approvedCompanyName: 'ABC Track Private Limited' },
      pre6: {
        residentDirectorFirstName: 'Priya',
        residentDirectorLastName: 'Sharma',
      },
    });

    const zip = new PizZip(buffer);
    const xmlEntries = zip.file(/\.xml$/);
    expect(xmlEntries.length).toBeGreaterThan(0);

    for (const entry of xmlEntries) {
      expect(parseXmlOrError(entry.asText())).toBeNull();
    }
  });
});

describe('renderIncorpDocxBuffer', () => {
  it.each(INCORP_DOC_KINDS)('produces valid Word XML for %s', (doc) => {
    const director = doc === 'pan-undertaking' ? 'non-resident' : 'non-resident';
    const buffer = renderIncorpDocxBuffer(doc, {
      pre1: { proposedName1: 'ABC India Private Limited' },
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Base,
      director,
    });
    expect(() => assertIncorpDocxWordXmlValid(buffer)).not.toThrow();
  });

  it('escapes XML-special characters in merge values', () => {
    const buffer = renderDir2DocxBuffer({
      pre5: { approvedCompanyName: 'ABC & Co <India> "Private"' },
      pre6: {
        ...pre6Base,
        nrDirectorUtilityBillAddress: 'Line 1 & Line 2 <test>',
      },
      director: 'non-resident',
    });
    assertIncorpDocxWordXmlValid(buffer);
    const xml = new PizZip(buffer).file('word/document.xml')?.asText() ?? '';
    expect(parseXmlOrError(xml)).toBeNull();
    expect(xml).toContain('ABC &amp; Co');
  });

  it('patchIncorpDocxBuffer updates paragraph text while preserving valid XML', () => {
    const original = renderDir2DocxBuffer({
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Base,
      director: 'non-resident',
    });
    const originalXml = new PizZip(original).file('word/document.xml')?.asText() ?? '';
    const paragraphCount = (originalXml.match(/<w:p[\s>]/g) ?? []).length;

    const editedLines = Array.from({ length: paragraphCount }, (_, index) =>
      index === 0 ? 'Edited opening paragraph' : `Line ${index + 1}`,
    );
    const content = editedLines.join('\n');

    const patched = patchIncorpDocxBuffer(original, content);
    assertIncorpDocxWordXmlValid(patched);

    const patchedXml = new PizZip(patched).file('word/document.xml')?.asText() ?? '';
    expect(parseXmlOrError(patchedXml)).toBeNull();
    expect(patchedXml).toContain('Edited opening paragraph');
  });

  it('patchIncorpDocxBuffer applies bold and alignment from structured content', () => {
    const original = renderDir2DocxBuffer({
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Base,
      director: 'non-resident',
    });
    const originalXml = new PizZip(original).file('word/document.xml')?.asText() ?? '';
    const paragraphCount = (originalXml.match(/<w:p[\s>]/g) ?? []).length;

    const content = JSON.stringify({
      br: 1,
      paragraphs: Array.from({ length: paragraphCount }, (_, index) =>
        index === 1
          ? { text: 'Centered bold line', line: '<strong>Centered bold line</strong>', align: 'center' }
          : { text: `Line ${index + 1}` },
      ),
    });

    const patched = patchIncorpDocxBuffer(original, content);
    assertIncorpDocxWordXmlValid(patched);

    const patchedXml = new PizZip(patched).file('word/document.xml')?.asText() ?? '';
    expect(patchedXml).toContain('Centered bold line');
    expect(patchedXml).toContain('w:val="center"');
    expect(patchedXml).toContain('<w:b');
  });

  it.each(INCORP_DOC_KINDS)(
    'patchIncorpDocxBuffer preserves valid XML for %s after structured edits',
    (doc) => {
      const director = 'non-resident';
      const original = renderIncorpDocxBuffer(doc, {
        pre1: { proposedName1: 'ABC India Private Limited' },
        pre5: { approvedCompanyName: 'ABC India Private Limited' },
        pre6: pre6Base,
        director,
      });
      const originalXml = new PizZip(original).file('word/document.xml')?.asText() ?? '';
      const paragraphCount = (originalXml.match(/<w:p[\s>]/g) ?? []).length;

      const content = JSON.stringify({
        br: 1,
        paragraphs: Array.from({ length: paragraphCount }, (_, index) =>
          index === 0
            ? {
                text: 'Edited with & "special" <chars>',
                line: '<strong>Bold edited line</strong>',
                align: 'center',
              }
            : { text: `Paragraph ${index + 1}` },
        ),
      });

      const patched = patchIncorpDocxBuffer(original, content);
      assertIncorpDocxWordXmlValid(patched);
      const patchedXml = new PizZip(patched).file('word/document.xml')?.asText() ?? '';
      expect(parseXmlOrError(patchedXml)).toBeNull();
      expect(patchedXml).toContain('Bold edited line');
    },
  );

  it.each(INCORP_DOC_KINDS)(
    'patchIncorpDocxBuffer repairs duplicate xml:space in stored %s before patching',
    (doc) => {
      const original = renderIncorpDocxBuffer(doc, {
        pre1: { proposedName1: 'ABC India Private Limited' },
        pre5: { approvedCompanyName: 'ABC India Private Limited' },
        pre6: pre6Base,
        director: 'non-resident',
      });
      const zip = new PizZip(original);
      const docXml = zip.file('word/document.xml')?.asText() ?? '';
      zip.file(
        'word/document.xml',
        docXml.replace(/xml:space="preserve"/, 'xml:space="preserve" xml:space="preserve"'),
      );
      const corrupted = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
      const paragraphCount = (docXml.match(/<w:p[\s>]/g) ?? []).length;
      const content = Array.from({ length: paragraphCount }, (_, i) => `Line ${i + 1}`).join('\n');

      expect(() => patchIncorpDocxBuffer(corrupted, content)).not.toThrow();
    },
  );

  it('patchIncorpDocxBuffer strips invalid XML control characters from edited text', () => {
    const original = renderPanUndertakingDocxBuffer({
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Base,
      director: 'non-resident',
    });
    const originalXml = new PizZip(original).file('word/document.xml')?.asText() ?? '';
    const paragraphCount = (originalXml.match(/<w:p[\s>]/g) ?? []).length;
    const content = Array.from({ length: paragraphCount }, (_, index) =>
      index === 0 ? `Line with\x01 control` : `Line ${index + 1}`,
    ).join('\n');

    expect(() => patchIncorpDocxBuffer(original, content)).not.toThrow();
  });
});

