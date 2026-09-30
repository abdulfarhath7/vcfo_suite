import PizZip from 'pizzip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_MAX_CHARS, chunkDocument } from '@/lib/assist/ingest/chunk';
import { docxToText, sourceKindFor } from '@/lib/assist/ingest/extract';

const getDoc = vi.fn();
const replaceChunks = vi.fn();
const setResult = vi.fn();
const getObjectBuffer = vi.fn();
const searchAssistChunks = vi.fn();
vi.mock('@/db/repositories/assist-documents', () => ({
  systemGetAssistDocument: (...a: unknown[]) => getDoc(...a),
  systemReplaceAssistChunks: (...a: unknown[]) => replaceChunks(...a),
  systemSetAssistDocumentResult: (...a: unknown[]) => setResult(...a),
  searchAssistChunks: (...a: unknown[]) => searchAssistChunks(...a),
}));
vi.mock('@/storage/s3', () => ({ getObjectBuffer: (...a: unknown[]) => getObjectBuffer(...a) }));

const { runAssistIngestion } = await import('@/lib/assist/ingest/run');
const { setAssistProviderForTests } = await import('@/lib/assist/provider');
const { retrieveSources } = await import('@/lib/assist/retrieve');

const para = (n: number) => `Paragraph ${n}. ` + 'The company must file the return within thirty days of the event. '.repeat(8);

beforeEach(() => {
  vi.clearAllMocks();
  setAssistProviderForTests(null);
});

describe('chunker', () => {
  it('splits by heading and keeps chunks within the size band', () => {
    const text = ['# Registration', para(1), para(2), '# Annual filings', para(3), para(4), para(5)].join('\n\n');
    const chunks = chunkDocument(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS + 40);
    expect(chunks[0]!.heading).toBe('Registration');
    expect(chunks.some((c) => c.heading === 'Annual filings')).toBe(true);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
  });

  it('breaks one huge paragraph at sentence ends', () => {
    const chunks = chunkDocument('The rule applies. '.repeat(400));
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
  });

  it('is deterministic and ignores empty input', () => {
    const text = ['# A', para(1), para(2)].join('\n\n');
    expect(chunkDocument(text)).toEqual(chunkDocument(text));
    expect(chunkDocument('   \n\n ')).toEqual([]);
  });
});

describe('extraction', () => {
  it('reads paragraphs and headings from a .docx', () => {
    const zip = new PizZip();
    zip.file(
      'word/document.xml',
      '<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>FEMA reporting</w:t></w:r></w:p><w:p><w:r><w:t>File FC-GPR within 30 days &amp; keep proof.</w:t></w:r></w:p></w:body></w:document>',
    );
    const text = docxToText(zip.generate({ type: 'nodebuffer' }));
    expect(text).toBe('# FEMA reporting\n\nFile FC-GPR within 30 days & keep proof.');
  });

  it('accepts only PDF, DOCX, TXT and MD', () => {
    expect(sourceKindFor('a.pdf', null)).toBe('pdf');
    expect(sourceKindFor('a.DOCX', null)).toBe('docx');
    expect(sourceKindFor('notes.md', null)).toBe('text');
    expect(sourceKindFor('sheet.xlsx', null)).toBeNull();
  });
});

describe('ingestion job', () => {
  const doc = { id: 'doc-1', title: 'GST guide', status: 'processing', s3Key: 'knowledge-bank/assist-sources/doc-1/guide.md' };

  it('is idempotent — a re-run replaces the same chunks, never adds more', async () => {
    getDoc.mockResolvedValue(doc);
    getObjectBuffer.mockResolvedValue(Buffer.from(['# GST', para(1), para(2), para(3)].join('\n\n')));
    const first = await runAssistIngestion('doc-1');
    const second = await runAssistIngestion('doc-1');
    expect(first).toEqual(second);
    expect(first.status).toBe('ready');
    expect(replaceChunks).toHaveBeenCalledTimes(2);
    expect(replaceChunks.mock.calls[0]).toEqual(replaceChunks.mock.calls[1]);
    expect(setResult).toHaveBeenLastCalledWith('doc-1', { status: 'ready' });
    // No provider configured: chunks are indexed without a context prefix.
    expect((replaceChunks.mock.calls[0]![1] as Array<{ contextPrefix: string | null }>)[0]!.contextPrefix).toBeNull();
  });

  it('marks a PDF failed with a readable reason when no model is configured', async () => {
    getDoc.mockResolvedValue({ ...doc, s3Key: 'knowledge-bank/assist-sources/doc-1/rules.pdf' });
    getObjectBuffer.mockResolvedValue(Buffer.from('%PDF-1.4'));
    expect((await runAssistIngestion('doc-1')).status).toBe('failed');
    expect(setResult).toHaveBeenLastCalledWith('doc-1', {
      status: 'failed',
      error: expect.stringContaining('PDF sources need the Assist model'),
    });
    expect(replaceChunks).not.toHaveBeenCalled();
  });

  it('skips archived sources', async () => {
    getDoc.mockResolvedValue({ ...doc, status: 'archived' });
    expect((await runAssistIngestion('doc-1')).status).toBe('skipped');
    expect(getObjectBuffer).not.toHaveBeenCalled();
  });
});

describe('retrieval audience', () => {
  it('asks the repository for the client persona on a client question', async () => {
    searchAssistChunks.mockResolvedValue([]);
    const ctx = { userId: 'c1', email: 'c@x.test', name: 'C', role: 'client' as const };
    await retrieveSources(ctx, { query: 'gst threshold', persona: 'client', topK: 5, applicability: null });
    expect(searchAssistChunks).toHaveBeenCalledWith(ctx, { query: 'gst threshold', persona: 'client', limit: 5 });
  });
});
