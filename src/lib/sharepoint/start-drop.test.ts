// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/** PLAN M4: one fetch reads SharePoint and the documents in the app; without SharePoint, the app's documents still are. */

const lead = { userId: 'lead-1', role: 'intern', internId: 'i-1' } as unknown as AuthContext;

const resolve = vi.fn();
vi.mock('./client-folder', async () => {
  class SharepointRefused extends Error {}
  return { resolveProjectFolder: (...a: unknown[]) => resolve(...a), SharepointRefused };
});
const created: Array<{ state: Record<string, unknown> }> = [];
vi.mock('@/db/repositories/ask-runs', () => ({
  createAskRun: async (_ctx: AuthContext, input: { state: Record<string, unknown> }) => {
    created.push(input);
    return { id: 'run-1' };
  },
  startQueuedAskRun: async () => true,
}));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: async () => undefined }));
const ownRows = vi.fn(async (..._a: unknown[]) => [] as Array<{ id: string; runId: string | null }>);
const updateRow = vi.fn();
vi.mock('@/db/repositories/ask-attachments', () => ({ getOwnAskAttachments: (...a: unknown[]) => ownRows(...a), updateOwnAskAttachment: (...a: unknown[]) => updateRow(...a) }));
vi.mock('@/db/repositories/engagements', () => ({ getEngagementById: async (_ctx: AuthContext, id: string) => (id === 'eng-1' ? { id, companyName: 'Bonterra India Private Limited' } : null) }));
const queue = vi.fn(async () => 'inline');
vi.mock('@/lib/ask/drop/run', () => ({ queueAskDrop: () => queue() }));

const { startSharepointDrop } = await import('./start-drop');
const { SharepointRefused } = (await import('./client-folder')) as unknown as { SharepointRefused: new (m: string) => Error };

beforeEach(() => {
  vi.clearAllMocks();
  created.length = 0;
});

describe('startSharepointDrop', () => {
  it('reads the SharePoint folder and the documents in the app together', async () => {
    resolve.mockResolvedValue({ kind: 'linked', link: { folderName: 'Bonterra' }, companyName: 'Bonterra India Private Limited' });
    const started = await startSharepointDrop(lead, { engagementId: 'eng-1', conversationId: 'c', message: 'fill bonterra into the app' });
    expect(started).toMatchObject({ ok: true, sources: 'the SharePoint folder Bonterra and the documents in the app' });
    expect(created[0]!.state.source).toMatchObject({ kind: 'sharepoint', engagementId: 'eng-1', folderName: 'Bonterra', appDocs: true });
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('still reads the documents in the app when SharePoint cannot be read, and says why in the closing note', async () => {
    resolve.mockRejectedValue(new SharepointRefused('SharePoint is not set up here.'));
    const started = await startSharepointDrop(lead, { engagementId: 'eng-1', conversationId: 'c', message: 'fill bonterra into the app' });
    expect(started).toMatchObject({ ok: true, sources: 'the documents in the app for Bonterra India Private Limited' });
    expect(created[0]!.state.source).toMatchObject({ sharepoint: false, appDocs: true, folderName: '' });
    expect(created[0]!.state.notes).toEqual(['SharePoint was not read: SharePoint is not set up here.']);
  });

  it('reads the files attached to the request in the same drop, the owner\'s rows only', async () => {
    resolve.mockResolvedValue({ kind: 'linked', link: { folderName: 'Bonterra' }, companyName: 'Bonterra India Private Limited' });
    ownRows.mockResolvedValue([{ id: 'att-1', runId: null }, { id: 'att-2', runId: 'other-run' }]);
    await startSharepointDrop(lead, { engagementId: 'eng-1', conversationId: 'c', message: 'fill bonterra into the app', attachmentIds: ['att-1', 'att-2', 'att-3'] });
    expect(ownRows).toHaveBeenCalledWith(lead, ['att-1', 'att-2', 'att-3']);
    expect(updateRow.mock.calls).toEqual([[lead, 'att-1', { runId: 'run-1', conversationId: 'c' }]]);
  });

  it('refuses as before when only SharePoint was asked for', async () => {
    resolve.mockRejectedValue(new SharepointRefused('SharePoint is not set up here.'));
    const started = await startSharepointDrop(lead, { engagementId: 'eng-1', conversationId: 'c', message: '', appDocs: false });
    expect(started).toEqual({ ok: false, message: 'SharePoint is not set up here.' });
    expect(created).toEqual([]);
  });
});
