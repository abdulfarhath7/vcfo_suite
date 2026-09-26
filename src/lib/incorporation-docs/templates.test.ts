import fs from 'fs';
import path from 'path';

import { DOMParser } from '@xmldom/xmldom';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

const TEMPLATE_FILES = [
  'dir-2.docx',
  'dir-8.docx',
  'inc-9.docx',
  'pan-undertaking.docx',
  'authorisation-letter.docx',
  'moa-aoa-subscription-sheet-foreign.docx',
  'moa-aoa-subscription-sheet-resident.docx',
] as const;

function documentXml(fileName: string): string {
  const templatePath = path.join(process.cwd(), 'public', 'templates', fileName);
  return new PizZip(fs.readFileSync(templatePath)).file('word/document.xml')?.asText() ?? '';
}

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

  it.each(['moa-aoa-subscription-sheet-foreign.docx', 'moa-aoa-subscription-sheet-resident.docx'])(
    'subscription sheet carries the witness and share-total tags: %s',
    (fileName) => {
      const xml = documentXml(fileName);
      for (const tag of ['{WITNESS_NAME}', '{WITNESS_ADDRESS}', '{WITNESS_OCCUPATION}', '{WITNESS_MEMBERSHIP}', '{TOTAL_SHARES_TAKEN}']) {
        expect(xml, tag).toContain(tag);
      }
      expect(parseXmlOrError(xml)).toBeNull();
    },
  );

  it('resident sheet loops one row per subscriber and holds no sample data', () => {
    const xml = documentXml('moa-aoa-subscription-sheet-resident.docx');
    expect((xml.match(/\{#SUBSCRIBERS\}/g) ?? []).length).toBe(2);
    expect((xml.match(/\{\/SUBSCRIBERS\}/g) ?? []).length).toBe(2);
    const text = xml.replace(/<[^>]+>/g, '');
    for (const sample of ['Naga', 'Ravanam', 'Aloha', 'Amalapuram', 'MITHILESH', 'SANNAREDDY', 'Reliance']) {
      expect(text, sample).not.toContain(sample);
    }
  });

  it('foreign sheet page 2 tags follow their labels', () => {
    const text = documentXml('moa-aoa-subscription-sheet-foreign.docx')
      .replace(/<[^>]+>/g, '')
      .replace(/\u00a0/g, ' ');
    expect(text.match(/company name: \{PARENT_ENTITY_NAME\}/g)).toHaveLength(2);
    expect(text.match(/Name: \{SUBSCRIBER_FULL_NAME\}/g)).toHaveLength(2);
    expect(text.match(/Nationality: \{SUBSCRIBER_NATIONALITY\}/g)).toHaveLength(2);
  });
});
