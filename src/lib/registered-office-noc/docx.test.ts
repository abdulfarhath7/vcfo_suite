import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { assertIncorpDocxWordXmlValid } from '@/lib/incorporation-docs/docx-validate';
import { buildNocDocx } from './docx';
import { blankNocInput, type NocInput } from './model';

const input: NocInput = {
  ...blankNocInput('Lotus & Dental Private Limited', '2026-10-29'),
  line1: 'Plot 42',
  line2: 'HITEC City Main Road',
  city: 'Hyderabad',
  state: 'Telangana',
  pin: '500081',
  agreementDate: '2026-10-01',
  billDate: '2026-10-10',
  ownerName: 'Ravi <Kumar>',
  relationName: 'Suresh Kumar',
  ownerAtPremises: true,
  place: 'Hyderabad',
};

describe('buildNocDocx', () => {
  it('builds a Word file with valid XML, A4, Times New Roman 12', () => {
    const buf = buildNocDocx(input);
    expect(() => assertIncorpDocxWordXmlValid(buf)).not.toThrow();
    const zip = new PizZip(buf);
    expect(Object.keys(zip.files).filter((n) => !n.endsWith('/')).sort()).toEqual(
      ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml'].sort(),
    );
    const doc = zip.file('word/document.xml')!.asText();
    expect(doc).toContain('NO OBJECTION CERTIFICATE');
    expect(doc).toContain('w:w="11906" w:h="16838"');
    expect(doc).toContain('Mr. Ravi &lt;Kumar&gt;');
    expect(doc).toContain('Lotus &amp; Dental Private Limited');
    expect(doc).toContain('Registrar of Companies, Hyderabad');
    expect(zip.file('word/styles.xml')!.asText()).toContain('w:ascii="Times New Roman"');
  });
});
