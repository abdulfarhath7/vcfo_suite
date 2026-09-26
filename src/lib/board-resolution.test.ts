import fs from 'fs';
import path from 'path';

import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

import {
  BOARD_RESOLUTION_MERGE_FIELD_KEYS,
  DEFAULT_NIC_CODES,
  buildBoardResolutionMergeFields,
  extractBoardResolutionInlineOverrides,
  formatDirectorList,
  generateBoardResolutionDraft,
  resolveCertificationPlace,
  stripDirectorSalutation,
} from '@/lib/board-resolution';
import { renderBoardResolutionDocxBuffer } from '@/lib/board-resolution-docx';

describe('stripDirectorSalutation', () => {
  it('removes common honorific prefixes', () => {
    expect(stripDirectorSalutation('Ms. Jane Doe')).toBe('Jane Doe');
    expect(stripDirectorSalutation('Mr. John Smith')).toBe('John Smith');
    expect(stripDirectorSalutation('Mr./Ms. Alex Chen')).toBe('Alex Chen');
  });
});

describe('formatDirectorList', () => {
  it('joins three director names without honorifics', () => {
    expect(
      formatDirectorList([
        { name: 'John Smith' },
        { name: 'Alex Chen' },
        { name: 'Maria Garcia' },
      ]),
    ).toBe('John Smith, Alex Chen and Maria Garcia');
  });
});

describe('resolveCertificationPlace', () => {
  it('uses trailing country from parent entity address', () => {
    expect(
      resolveCertificationPlace({
        parentEntityAddress: '100 Market Street, Salt Lake City, Utah, USA',
      }),
    ).toBe('USA');
  });

  it('falls back to default when address is missing', () => {
    expect(resolveCertificationPlace({})).toBe('USA');
  });
});

describe('buildBoardResolutionMergeFields NIC_CODES', () => {
  it('uses pre-1 nicCodes without duplicating the default list', () => {
    const custom =
      '62099- Other information technology and computer service activities n.e.c';
    const fields = buildBoardResolutionMergeFields({ pre1: { nicCodes: custom } });
    expect(fields.NIC_CODES).toBe(custom);
    expect(fields.NIC_CODES).not.toBe(`${custom}, ${DEFAULT_NIC_CODES}`);
  });

  it('includes default NIC codes once in plain-text draft', () => {
    const draft = generateBoardResolutionDraft({});
    expect(draft.split('62099').length - 1).toBe(1);
    expect(draft.split('62020').length - 1).toBe(1);
  });
});

describe('extractBoardResolutionInlineOverrides', () => {
  it('extracts edited address and place from preview plain text', () => {
    const fields = buildBoardResolutionMergeFields({
      pre1: {
        parentEntityName: 'ABC Holdings LLC',
        parentEntityAddress: 'Old Address, USA',
        boardResolutionDate: '2026-05-26',
      },
    });

    const overrides = extractBoardResolutionInlineOverrides(
      [
        'For and on behalf of ABC Holdings LLC',
        'New Address Line, Denver, USA',
        'Authorised Person: Jane Doe',
        'Place: Denver',
      ].join('\n'),
      fields,
    );

    expect(overrides.PARENT_ENTITY_ADDRESS).toBe('New Address Line, Denver, USA');
    expect(overrides.CERTIFICATION_PLACE).toBe('Denver');
  });
});

function documentPlainText(documentXml: string): string {
  return [...documentXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

function nicClausePlainText(documentXml: string): string {
  const plain = documentPlainText(documentXml);
  const nicIdx = plain.indexOf('NIC) codes:');
  if (nicIdx === -1) return '';
  const afterNic = plain.slice(nicIdx);
  const resolvedIdx = afterNic.indexOf('RESOLVED FURTHER THAT');
  return resolvedIdx === -1 ? afterNic : afterNic.slice(0, resolvedIdx);
}

describe('prepared boardResolution.docx template', () => {
  const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');

  it('includes every merge field tag at least once', () => {
    if (!fs.existsSync(templatePath)) return;

    const zip = new PizZip(fs.readFileSync(templatePath));
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    const found = new Set(
      [...documentXml.matchAll(/\{([A-Z][A-Z0-9_]*)\}/g)].map((match) => match[1]),
    );

    for (const key of BOARD_RESOLUTION_MERGE_FIELD_KEYS) {
      expect(found.has(key), `missing {${key}} in prepared template`).toBe(true);
    }
  });

  it('has a single NIC_CODES tag without leftover sample NIC literals', () => {
    if (!fs.existsSync(templatePath)) return;

    const documentXml =
      new PizZip(fs.readFileSync(templatePath)).file('word/document.xml')?.asText() ?? '';
    expect((documentXml.match(/\{NIC_CODES\}/g) ?? []).length).toBe(1);

    const nicClause = nicClausePlainText(documentXml);
    expect(nicClause).toContain('{NIC_CODES}');
    expect(nicClause).not.toMatch(/62099|62020/);
  });

  it('uses plain letterhead instruction text in the header (no faux braces)', () => {
    if (!fs.existsSync(templatePath)) return;

    const headerXml =
      new PizZip(fs.readFileSync(templatePath)).file('word/header1.xml')?.asText() ?? '';
    expect(headerXml).toContain('On the letter head of the Parent Entity');
    expect(headerXml).not.toContain('{On the letter head of the Parent Entity}');
  });
});

describe('renderBoardResolutionDocxBuffer NIC merge', () => {
  it('does not duplicate NIC codes in the rendered document body', () => {
    const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');
    if (!fs.existsSync(templatePath)) return;

    const docx = renderBoardResolutionDocxBuffer({
      pre1: { nicCodes: '62099- sample NIC only' },
    });
    const documentXml = new PizZip(docx).file('word/document.xml')?.asText() ?? '';
    const nicClause = nicClausePlainText(documentXml);

    expect(nicClause).toContain('62099- sample NIC only');
    expect(nicClause).not.toContain(DEFAULT_NIC_CODES.slice(0, 20));
    expect((nicClause.match(/62099/g) ?? []).length).toBe(1);
  });
});

describe('parent jurisdiction and NIC code come from Part A answers', () => {
  const UK_PARENT = {
    parentEntityName: 'Test Parent Ltd',
    parentEntityAddress: '1 Parent Street, London',
    parentEntityCountry: 'United Kingdom',
    parentEntityState: '',
  };

  it('a UK parent (no state) never reads Utah', () => {
    const fields = buildBoardResolutionMergeFields({ pre1: UK_PARENT });
    expect(fields.PARENT_JURISDICTION).toBe('the United Kingdom');
    expect(fields.PARENT_STATE).toBe('');
    expect(fields.CERTIFICATION_PLACE).toBe('United Kingdom');

    const draft = generateBoardResolutionDraft({ pre1: UK_PARENT });
    expect(draft).not.toContain('Utah');
    expect(draft).toContain('the laws of the United Kingdom, and the governing documents');
  });

  it('an answered state prints as the State of …', () => {
    const fields = buildBoardResolutionMergeFields({
      pre1: { ...UK_PARENT, parentEntityCountry: 'United States of America', parentEntityState: 'Delaware' },
    });
    expect(fields.PARENT_JURISDICTION).toBe('the United States of America');
    expect(fields.PARENT_STATE).toBe('Delaware');
  });

  it('renders the Word file without the State phrase for a UK parent', () => {
    const templatePath = path.join(process.cwd(), 'public/templates/boardResolution.docx');
    if (!fs.existsSync(templatePath)) return;
    const xml = new PizZip(renderBoardResolutionDocxBuffer({ pre1: UK_PARENT })).file('word/document.xml')!.asText();
    const text = documentPlainText(xml);
    expect(text).toContain('laws of the United Kingdom, and the governing documents');
    expect(text).not.toContain('State of');
    expect(text).not.toContain('{');

    const us = new PizZip(
      renderBoardResolutionDocxBuffer({ pre1: { parentEntityCountry: 'United States of America', parentEntityState: 'Delaware' } }),
    )
      .file('word/document.xml')!
      .asText();
    expect(documentPlainText(us)).toContain('the laws of the United States of America, the State of Delaware, and');
  });

  it('NIC_CODES reads the Part A nicCode with its description', () => {
    const fields = buildBoardResolutionMergeFields({
      pre1: { nicCode: '62011', nicBusinessType: 'Writing, modifying, testing of computer program' },
    });
    expect(fields.NIC_CODES).toBe('62011- Writing, modifying, testing of computer program');
    expect(fields.NIC_CODES).not.toContain('62099');
    // Description looked up when the stored one is missing.
    expect(buildBoardResolutionMergeFields({ pre1: { nicCode: '62011' } }).NIC_CODES).toMatch(/^62011- \S/);
  });

  it('legacy Part A (no country, no NIC code) → today’s output', () => {
    const fields = buildBoardResolutionMergeFields({
      pre1: { parentEntityAddress: '100 Market Street, Salt Lake City, Utah, USA' },
    });
    expect(fields.PARENT_JURISDICTION).toBe('the United States of America');
    expect(fields.PARENT_STATE).toBe('Utah');
    expect(fields.CERTIFICATION_PLACE).toBe('USA');
    expect(fields.NIC_CODES).toBe(DEFAULT_NIC_CODES);
  });
});
