import fs from 'fs';
import path from 'path';

import { DOMParser } from '@xmldom/xmldom';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

const TEMPLATE_FILES = ['dir-2.docx', 'dir-8.docx', 'inc-9.docx', 'pan-undertaking.docx'] as const;

function parseXmlOrError(xml: string): string | null {
  try {
    new DOMParser().parseFromString(xml, 'application/xml');
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'XML parse failed';
  }
}

function countDuplicateAttrs(xml: string): number {
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

describe('prepared incorporation templates', () => {
  it.each(TEMPLATE_FILES)('has valid word XML parts: %s', (fileName) => {
    const templatePath = path.join(process.cwd(), 'public', 'templates', fileName);
    expect(fs.existsSync(templatePath)).toBe(true);

    const zip = new PizZip(fs.readFileSync(templatePath));
    const xmlEntries = zip.file(/word\/.*\.xml$/);
    expect(xmlEntries.length).toBeGreaterThan(0);

    for (const entry of xmlEntries) {
      const xml = entry.asText();
      expect(countDuplicateAttrs(xml)).toBe(0);
    }
  });

  it('keeps INC-9 merge placeholders as intact tags in document.xml', () => {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'inc-9.docx');
    const zip = new PizZip(fs.readFileSync(templatePath));
    const xml = zip.file('word/document.xml')?.asText() ?? '';

    expect(xml).toContain('{PROPOSED_COMPANY_NAME}');
    expect((xml.match(/\{DIRECTOR_FULL_NAME\}/g) ?? []).length).toBe(2);
    expect(xml).toContain('{DOCUMENT_DATE}');
    expect(xml).toContain('{DOCUMENT_PLACE}');
    expect(parseXmlOrError(xml)).toBeNull();
  });
});
