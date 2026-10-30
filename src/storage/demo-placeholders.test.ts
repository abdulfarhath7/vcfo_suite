import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Demo seed placeholders: the S3 key follows the documents route mapping, the PDF is valid, an
 * existing object is never overwritten, and a storage failure stops the uploads without a throw.
 */

const existing = new Set<string>();
const puts: string[] = [];
let failPut = false;

vi.mock('@/storage/s3', () => ({
  bucketKey: (bucket: string, path: string) => `${bucket}/${path.replace(/^\/+/, '')}`,
  objectExists: async (key: string) => existing.has(key),
  putObject: async (key: string) => {
    if (failPut) throw new Error('connect ECONNREFUSED');
    puts.push(key);
    existing.add(key);
  },
}));

const { documentStorageKey, placeholderPdf, putPlaceholderIfMissing, seedPlaceholders } = await import('./demo-placeholders');

beforeEach(() => {
  existing.clear();
  puts.length = 0;
  failPut = false;
});

describe('documentStorageKey', () => {
  it('puts a plain demo key in the engagement documents bucket', () => {
    expect(documentStorageKey('demo/acme/pre-2-name-approval.pdf')).toBe('engagement-documents/demo/acme/pre-2-name-approval.pdf');
  });

  it('keeps a key that already names its bucket', () => {
    expect(documentStorageKey('milestone-documents/e1/field/1-a.pdf')).toBe('milestone-documents/e1/field/1-a.pdf');
    expect(documentStorageKey('/engagement-documents/e1/x.pdf')).toBe('engagement-documents/e1/x.pdf');
  });

  it('sends a milestone path to the milestone bucket', () => {
    expect(documentStorageKey('e1/someField/1700000000-a.pdf')).toBe('milestone-documents/e1/someField/1700000000-a.pdf');
  });
});

describe('placeholderPdf', () => {
  it('is a PDF with a correct cross-reference offset', () => {
    const text = placeholderPdf('Acme: Board resolution — signed.pdf').toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const start = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    expect(text).toContain('(Acme: Board resolution - signed.pdf)');
  });
});

describe('putPlaceholderIfMissing', () => {
  it('uploads once and then skips the existing object', async () => {
    expect(await putPlaceholderIfMissing('k1', 'One')).toBe('uploaded');
    expect(await putPlaceholderIfMissing('k1', 'One')).toBe('exists');
    expect(puts).toEqual(['k1']);
  });
});

describe('seedPlaceholders', () => {
  it('counts uploads and existing objects', async () => {
    existing.add('a');
    const out = await seedPlaceholders([{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }]);
    expect(out).toEqual({ uploaded: 1, existing: 1, failed: null });
  });

  it('stops at the first storage failure and reports it', async () => {
    failPut = true;
    const out = await seedPlaceholders([{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }]);
    expect(out.uploaded).toBe(0);
    expect(out.failed).toContain('ECONNREFUSED');
  });
});
