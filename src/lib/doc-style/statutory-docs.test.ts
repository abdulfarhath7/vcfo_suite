// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import { describe, expect, it, vi } from 'vitest';

import { renderBoardResolutionDocxBuffer } from '@/lib/board-resolution/board-resolution-docx';
import { noticeDocx } from '@/lib/board-meetings/notice-docx';
import { resolutionDocx } from '@/lib/board-meetings/resolution';
import { renderIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import { INCORP_DOC_KINDS } from '@/lib/incorporation-docs/types';

import { docxRunProps, spectrumAccentHexes } from './spectrum-docx';
import { SPECTRUM_FONTS } from './spectrum-tokens';

vi.mock('server-only', () => ({}));

/**
 * Statutory and filing documents (class (a) in docs/context/notes/incorporation-docs.md) keep
 * the layout MCA expects: no Spectrum accent colour and no Spectrum face may reach them.
 */
const ACCENTS = new Set(spectrumAccentHexes());

function spectrumLeaks(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const leaks: string[] = [];
  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith('.xml')) continue;
    const xml = zip.file(name)?.asText() ?? '';
    for (const m of xml.matchAll(/w:(?:color w:val|val|fill|color)="([0-9A-Fa-f]{6})"/g)) {
      if (ACCENTS.has(m[1]!.toUpperCase())) leaks.push(`${name}: ${m[0]}`);
    }
    for (const face of Object.values(SPECTRUM_FONTS)) {
      if (xml.includes(`"${face}"`)) leaks.push(`${name}: font ${face}`);
    }
  }
  return leaks;
}

const input = {
  pre1: { proposedName1: 'ABC India Private Limited' },
  pre5: { approvedCompanyName: 'ABC India Private Limited' },
  pre6: {
    nrDirectorFirstName: 'Justin',
    nrDirectorLastName: 'Hsu',
    nrDirectorPassportNumber: 'P2982018',
    residentDirectorFirstName: 'Priya',
    residentDirectorLastName: 'Sharma',
    residentDirectorPanNumber: 'ABCDE1234F',
    residentDirectorDin: '01234567',
  },
};

describe('statutory documents carry no Spectrum styling', () => {
  it('the check itself catches a Spectrum run', () => {
    const zip = new PizZip();
    zip.file('word/document.xml', `<w:document><w:r>${docxRunProps({ color: 'brandText' })}</w:r></w:document>`);
    const leaks = spectrumLeaks(zip.generate({ type: 'nodebuffer' }) as Buffer);
    expect(leaks.some((l) => l.includes('font'))).toBe(true);
    expect(leaks.some((l) => l.includes('w:color'))).toBe(true);
  });

  it.each(INCORP_DOC_KINDS)('incorporation draft %s', (doc) => {
    expect(spectrumLeaks(renderIncorpDocxBuffer(doc, { ...input, director: 'non-resident' }))).toEqual([]);
  });

  it('board resolution (certified true copy)', () => {
    expect(spectrumLeaks(renderBoardResolutionDocxBuffer({ pre1: { boardResolutionDate: '2026-05-26' } }))).toEqual([]);
  });

  it('every .docx template in public/templates', () => {
    const dir = path.join(process.cwd(), 'public/templates');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.docx'))) {
      expect(spectrumLeaks(fs.readFileSync(path.join(dir, file))), file).toEqual([]);
    }
  });

  it('board meeting notice and circular resolution', () => {
    const notice = noticeDocx({
      title: 'NOTICE OF BOARD MEETING',
      ref: 'NIPL/BM/02/2026-27',
      dated: '03 September 2026',
      salutation: 'To the Directors',
      subject: 'Notice of the Board Meeting',
      body: ['Notice is hereby given.'],
      closing: ['Thanking you,', 'For the Company'],
      signatory: ['Rahul Bhide', 'Director', 'DIN: 10211790'],
      toHeading: 'To:',
      to: ['A Director'],
      agendaTitle: 'AGENDA',
      agendaMeta: [['DATE:', '10 September 2026']],
      agendaIntro: 'Items:',
      agenda: [{ n: '1', text: 'To elect the Chairperson.', subs: [] }],
      footer: ['NetDocuments India Private Limited', 'CIN: U62099TS2025FTC205994'],
    });
    expect(spectrumLeaks(notice)).toEqual([]);
    const resolution = resolutionDocx({
      companyName: 'NetDocuments India Private Limited',
      cin: null,
      address: null,
      title: 'Opening of a current account',
      description: 'the Company opens a current account',
      resolutionDate: '2026-09-25',
      meetingNo: 'NIPL/BM/02/2026-27',
      meetingDate: '2026-09-10',
      changesItem: null,
      signers: [{ name: 'Rahul Hari Bhide', din: '10211790' }],
    });
    expect(spectrumLeaks(resolution)).toEqual([]);
  });
});
