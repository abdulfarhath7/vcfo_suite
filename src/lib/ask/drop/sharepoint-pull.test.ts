import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { DriveItem } from '@/lib/sharepoint/graph';

const createAskAttachment = vi.fn();
const listAskRunAttachments = vi.fn();
vi.mock('@/db/repositories/ask-attachments', () => ({
  createAskAttachment: (...a: unknown[]) => createAskAttachment(...a),
  listAskRunAttachments: (...a: unknown[]) => listAskRunAttachments(...a),
}));
const listSeen = vi.fn();
const recordCopied = vi.fn();
vi.mock('@/db/repositories/sharepoint-files-seen', () => ({
  listSeenSharepointFiles: (...a: unknown[]) => listSeen(...a),
  recordSharepointFileCopied: (...a: unknown[]) => recordCopied(...a),
}));
const putObject = vi.fn();
vi.mock('@/storage/s3', () => ({ putObject: (...a: unknown[]) => putObject(...a) }));

const projectFolderLink = vi.fn();
const openClientsRoot = vi.fn();
class SharepointRefused extends Error {}
vi.mock('@/lib/sharepoint/client-folder', () => ({
  projectFolderLink: (...a: unknown[]) => projectFolderLink(...a),
  openClientsRoot: (...a: unknown[]) => openClientsRoot(...a),
  SharepointRefused,
}));

const children: Record<string, DriveItem[]> = {};
const graphDownload = vi.fn();
vi.mock('@/lib/sharepoint/graph', () => ({
  graphListChildren: async (_a: string, _d: string, id: string) => children[id] ?? [],
  graphDownload: (...a: unknown[]) => graphDownload(...a),
}));

const { pullSharepointFiles, DOWNLOAD_FAILED } = await import('./sharepoint-pull');

const lead: AuthContext = { userId: 'u-lead', email: 'sasi@x.test', name: 'Sasi', role: 'intern' };
const run = { id: 'run-1', conversationId: 'conv-1' };
const source = { kind: 'sharepoint' as const, engagementId: 'eng-1', folderName: 'Kestrel' };

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(children)) delete children[key];
  projectFolderLink.mockResolvedValue({ driveId: 'drive-1', folderId: 'root', folderName: 'Kestrel Analytics' });
  openClientsRoot.mockResolvedValue({ access: 'tok', driveId: 'drive-1', rootId: 'clients' });
  listAskRunAttachments.mockResolvedValue([]);
  graphDownload.mockResolvedValue(Buffer.from('%PDF-1.4'));
  listSeen.mockResolvedValue(new Map());
  createAskAttachment.mockImplementation(async (_c: unknown, input: { relativePath: string }) => ({ id: `att:${input.relativePath}` }));
});

describe('pullSharepointFiles', () => {
  it('copies each file into the drop with its SharePoint path, client folder first', async () => {
    children.root = [{ id: 'a', name: 'PAN.pdf', size: 8, file: {} }, { id: 'f', name: 'Directors', size: 0, folder: {} }];
    children.f = [{ id: 'b', name: 'Ravi Aadhaar.jpg', size: 8, file: {} }];
    const result = await pullSharepointFiles(lead, run, source);
    expect(result).toEqual({ copied: 2, skipped: [] });
    expect(createAskAttachment.mock.calls.map((c) => c[1].relativePath)).toEqual(['Kestrel Analytics/Directors/Ravi Aadhaar.jpg', 'Kestrel Analytics/PAN.pdf']);
    expect(createAskAttachment.mock.calls[0]![1]).toMatchObject({ kind: 'file', runId: 'run-1', conversationId: 'conv-1', contentType: 'image/jpeg' });
    expect(putObject).toHaveBeenCalledTimes(2);
  });

  it('does not copy a file again on a retry', async () => {
    children.root = [{ id: 'a', name: 'PAN.pdf', size: 8, file: {} }];
    listAskRunAttachments.mockResolvedValue([{ relativePath: 'Kestrel Analytics/PAN.pdf' }]);
    expect((await pullSharepointFiles(lead, run, source)).copied).toBe(0);
    expect(graphDownload).not.toHaveBeenCalled();
  });

  it('lists a file it cannot download or read, and keeps going', async () => {
    children.root = [{ id: 'a', name: 'A.pdf', size: 8, file: {} }, { id: 'b', name: 'B.pdf', size: 8, file: {} }, { id: 'c', name: 'C.dwg', size: 8, file: {} }];
    graphDownload.mockRejectedValueOnce(new Error('graph_download_500'));
    const result = await pullSharepointFiles(lead, run, source);
    expect(result.copied).toBe(1);
    expect(result.skipped).toEqual([
      expect.objectContaining({ attachmentId: 'sharepoint:c', path: 'Kestrel Analytics/C.dwg', status: 'skipped' }),
      { attachmentId: 'sharepoint:a', path: 'Kestrel Analytics/A.pdf', size: 8, status: 'failed', reason: DOWNLOAD_FAILED },
    ]);
  });

  it('reports progress before the first file and after each one, a failed download included', async () => {
    children.root = [{ id: 'a', name: 'A.pdf', size: 8, file: {} }, { id: 'b', name: 'B.pdf', size: 8, file: {} }, { id: 'c', name: 'C.pdf', size: 8, file: {} }];
    graphDownload.mockRejectedValueOnce(new Error('graph_download_500'));
    const seen: Array<[number, number]> = [];
    await pullSharepointFiles(lead, run, source, (done, total) => {
      seen.push([done, total]);
    });
    expect(seen).toEqual([[0, 3], [1, 3], [2, 3], [3, 3]]);
  });

  it('starts the count at the files a retry already copied', async () => {
    children.root = [{ id: 'a', name: 'A.pdf', size: 8, file: {} }, { id: 'b', name: 'B.pdf', size: 8, file: {} }];
    listAskRunAttachments.mockResolvedValue([{ relativePath: 'Kestrel Analytics/A.pdf' }]);
    const seen: Array<[number, number]> = [];
    await pullSharepointFiles(lead, run, source, (done, total) => {
      seen.push([done, total]);
    });
    expect(seen).toEqual([[1, 2], [2, 2]]);
    expect(graphDownload).toHaveBeenCalledTimes(1);
  });

  it('leaves out files an earlier fetch read unchanged, and records each copy with its bytes hash', async () => {
    children.root = [
      { id: 'a', name: 'A.pdf', size: 8, file: {}, cTag: 'c1' },
      { id: 'b', name: 'B.pdf', size: 8, file: {}, cTag: 'c2' },
      { id: 'c', name: 'C.pdf', size: 8, file: {}, cTag: 'c3' },
    ];
    listSeen.mockResolvedValue(new Map([
      ['a', { itemId: 'a', cTag: 'c1', sha256: 'x', readKey: 'k' }],
      ['b', { itemId: 'b', cTag: 'OLD', sha256: 'y', readKey: 'k' }],
      ['c', { itemId: 'c', cTag: 'c3', sha256: 'z', readKey: null }],
    ]));
    const result = await pullSharepointFiles(lead, run, source);
    expect(result.copied).toBe(2);
    expect(result.note).toBe('1 file was read in an earlier fetch and did not change, so I left it out.');
    expect(recordCopied.mock.calls.map((c) => c[2].itemId)).toEqual(['b', 'c']);
    expect(recordCopied.mock.calls[0]![2]).toMatchObject({ cTag: 'c2', path: 'Kestrel Analytics/B.pdf', attachmentId: 'att:Kestrel Analytics/B.pdf' });
    expect(recordCopied.mock.calls[0]![2].sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('says nothing is new when every file was read before', async () => {
    children.root = [{ id: 'a', name: 'A.pdf', size: 8, file: {}, cTag: 'c1' }];
    listSeen.mockResolvedValue(new Map([['a', { itemId: 'a', cTag: 'c1', sha256: 'x', readKey: 'k' }]]));
    const result = await pullSharepointFiles(lead, run, source);
    expect(result).toMatchObject({ copied: 0 });
    expect(result.note).toContain('Nothing new in the SharePoint folder Kestrel Analytics');
  });

  it('turns a refusal for the whole folder into a note and copies nothing', async () => {
    openClientsRoot.mockRejectedValue(new SharepointRefused('Please reconnect Microsoft 365.'));
    expect(await pullSharepointFiles(lead, run, source)).toEqual({ copied: 0, skipped: [], note: 'Please reconnect Microsoft 365.' });
    projectFolderLink.mockResolvedValue(null);
    expect((await pullSharepointFiles(lead, run, source)).note).toContain('no longer linked');
  });

  it('says so when the folder is empty', async () => {
    children.root = [];
    expect((await pullSharepointFiles(lead, run, source)).note).toBe('The SharePoint folder Kestrel Analytics has no files in it.');
  });
});
