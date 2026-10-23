import { describe, expect, it } from 'vitest';
import { formatFileSize, titleFromFileName, validateSourceFile } from '@/lib/ask/source-file';
import { looksScanned, tidyPdfText } from '@/lib/ask/ingest/extract';

describe('validateSourceFile (drop zone + form)', () => {
  it('accepts PDF, DOCX, TXT and MD of a sane size', () => {
    for (const name of ['a.pdf', 'B.DOCX', 'notes.txt', 'readme.md']) {
      expect(validateSourceFile({ name, size: 1024 })).toBeNull();
    }
  });

  it('refuses other types, empty files and oversized files with a readable reason', () => {
    expect(validateSourceFile({ name: 'photo.png', size: 10 })).toMatch(/not a PDF, DOCX, TXT or MD/);
    expect(validateSourceFile({ name: 'a.pdf', size: 0 })).toMatch(/empty/);
    expect(validateSourceFile({ name: 'a.pdf', size: 10 * 1024 * 1024 * 1024 })).toMatch(/larger than/);
  });

  it('suggests a title from the file name', () => {
    expect(titleFromFileName('GST-return-filing_FY26.pdf')).toBe('GST return filing FY26');
    expect(titleFromFileName('note.md')).toBe('note');
  });

  it('formats sizes for the chosen-file row', () => {
    expect(formatFileSize(900)).toBe('900 B');
    expect(formatFileSize(20 * 1024)).toBe('20 KB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('PDF text layer helpers', () => {
  it('treats a near-empty text layer as a scan, a normal one as text', () => {
    expect(looksScanned('', 3)).toBe(true);
    expect(looksScanned('a b c', 1)).toBe(true);
    expect(looksScanned('The registered office of the company shall be situated in the State of Karnataka. '.repeat(3), 1)).toBe(false);
  });

  it('tidies spacing and marks title-like lines as headings', () => {
    const raw = 'SECTION 12   REGISTERED OFFICE\n\n\n\nThe company   shall keep\nits registered office.\n1. Scope of this rule\nText.';
    const out = tidyPdfText(raw);
    expect(out).toContain('# SECTION 12 REGISTERED OFFICE');
    expect(out).toContain('# 1. Scope of this rule');
    expect(out).toContain('The company shall keep\nits registered office.');
    expect(out).not.toMatch(/\n{3,}/);
  });
});

describe('isCoveredBySources (uploaded documents widen the guard scope)', () => {
  it('keeps questions most of whose terms one source chunk holds', async () => {
    const { isCoveredBySources } = await import('@/lib/ask/pipeline');
    expect(isCoveredBySources({ terms: 3, matched: 2 })).toBe(true); // "Who owns VCFO Suite?"
    expect(isCoveredBySources({ terms: 7, matched: 5 })).toBe(true); // "Which AWS service hosts …"
    expect(isCoveredBySources({ terms: 6, matched: 6 })).toBe(true);
  });

  it('still refuses when only a stray word or two is shared', async () => {
    const { isCoveredBySources } = await import('@/lib/ask/pipeline');
    expect(isCoveredBySources({ terms: 5, matched: 2 })).toBe(false); // "Python script to sort a list"
    expect(isCoveredBySources({ terms: 3, matched: 1 })).toBe(false); // "weather in Paris"
    expect(isCoveredBySources({ terms: 1, matched: 1 })).toBe(false); // one word is never enough
    expect(isCoveredBySources({ terms: 0, matched: 0 })).toBe(false);
  });
});
