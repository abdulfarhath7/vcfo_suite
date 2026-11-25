// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * PLAN M3: the documents already in the app join a fetch. The list comes from the person's own
 * Documents tree (so only what they can open), nothing is copied, and a file read before is reused
 * without a download.
 */

const lead = { userId: 'lead-1', role: 'intern', internId: 'i-1' } as unknown as AuthContext;
const run = { id: 'run-1', conversationId: 'conv-1' };

const docs = vi.fn();
vi.mock('@/db/repositories/client-documents', () => ({ listAppDocumentFiles: (...a: unknown[]) => docs(...a) }));
const created: Array<Record<string, unknown>> = [];
vi.mock('@/db/repositories/ask-attachments', () => ({
  createAskAttachment: async (_ctx: AuthContext, input: Record<string, unknown>) => {
    created.push(input);
    return { id: `att-${created.length}`, ...input };
  },
  listAskRunAttachments: async () => [],
}));
const listSeen = vi.fn(async () => new Map());
const recordCopied = vi.fn();
vi.mock('@/db/repositories/sharepoint-files-seen', () => ({
  listSeenSharepointFiles: (...a: unknown[]) => listSeen(...(a as [])),
  recordSharepointFileCopied: (...a: unknown[]) => recordCopied(...a),
}));
const objects = new Map<string, Buffer>();
const getObjectBuffer = vi.fn(async (key: string) => objects.get(key) ?? null);
vi.mock('@/storage/s3', () => ({ getObjectBuffer: (key: string) => getObjectBuffer(key) }));

const { pullAppDocuments } = await import('./app-docs-pull');

const doc = (ref: string, label: string, fileName: string, key: string, sizeBytes = 5) => ({ ref, label, fileName, key, sizeBytes, stepId: null, date: null });

beforeEach(() => {
  vi.clearAllMocks();
  created.length = 0;
  objects.clear();
  objects.set('engagement-documents/e1/board-resolution.docx', Buffer.from('PK-br'));
  objects.set('engagement-documents/e1/moa.pdf', Buffer.from('%PDF'));
  objects.set('milestone-documents/e1/panCopyUrl/1-pan.jpg', Buffer.from('jpeg'));
  docs.mockResolvedValue([
    doc('br:final', 'Board resolution (final)', 'board-resolution.docx', 'engagement-documents/e1/board-resolution.docx'),
    doc('d:moa', 'Moa', 'moa.pdf', 'engagement-documents/e1/moa.pdf', 4),
    doc('m:e1/panCopyUrl/1-pan.jpg', 'Copy of PAN card', 'pan.jpg', 'milestone-documents/e1/panCopyUrl/1-pan.jpg', 4),
    doc('d:plan', 'Plan', 'plan.dwg', 'engagement-documents/e1/plan.dwg'),
  ]);
});

describe('pullAppDocuments', () => {
  it('adds every readable document the person can open, as rows pointing at the stored file', async () => {
    const result = await pullAppDocuments(lead, run, { engagementId: 'eng-1' });
    // The list is read as the person: their AuthContext and the project they asked for.
    expect(docs).toHaveBeenCalledWith(lead, 'eng-1');
    expect(result.files.map((f) => [f.path, f.origin, f.status])).toEqual([
      ['In the app/Board resolution (final)/board-resolution.docx', 'app', 'queued'],
      ['In the app/Moa/moa.pdf', 'app', 'queued'],
      ['In the app/Copy of PAN card/pan.jpg', 'app', 'queued'],
    ]);
    // Nothing is copied: the row reads the file where it is.
    expect(created[0]).toMatchObject({ kind: 'file', runId: 'run-1', s3Key: 'engagement-documents/e1/board-resolution.docx' });
    expect(recordCopied.mock.calls.map((c) => (c[2] as { itemId: string }).itemId)).toEqual(['app:br:final', 'app:d:moa', 'app:m:e1/panCopyUrl/1-pan.jpg']);
    expect((recordCopied.mock.calls[0]![2] as { sha256: string }).sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reuses a stored read of an unchanged file without downloading it, and keeps new reads within the room', async () => {
    listSeen.mockResolvedValue(
      new Map([['app:br:final', { itemId: 'app:br:final', cTag: 'engagement-documents/e1/board-resolution.docx|5', sha256: 'old', readKey: 'reads/br.json' }]]),
    );
    const result = await pullAppDocuments(lead, run, { engagementId: 'eng-1' }, { room: 1 });
    expect(result.reused).toBe(1);
    expect(getObjectBuffer).not.toHaveBeenCalledWith('engagement-documents/e1/board-resolution.docx');
    expect(recordCopied.mock.calls[0]![2]).toMatchObject({ itemId: 'app:br:final', sha256: 'old' });
    // One new file fits; the PAN copy waits for the next fetch.
    expect(result.files.map((f) => f.path)).toEqual(['In the app/Board resolution (final)/board-resolution.docx', 'In the app/Moa/moa.pdf']);
    expect(result.note).toMatch(/1 more document in the app was left for the next fetch/);
  });

  it('reads nothing for a project the person cannot open', async () => {
    docs.mockResolvedValue([]);
    expect(await pullAppDocuments(lead, run, { engagementId: 'eng-x' })).toEqual({ files: [], reused: 0 });
    expect(created).toEqual([]);
  });
});
