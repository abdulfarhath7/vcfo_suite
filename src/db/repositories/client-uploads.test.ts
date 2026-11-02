import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * G-09: several files answer one open request in one upload, on Home (client-home,
 * `documents` rows) and on Documents (client-documents, `document_request_files` rows).
 * Both stay inside the caller's own engagement: a request of another company is
 * "not found" and nothing is written. Undo removes the whole batch.
 */

const assertEngagementAccess = vi.fn();
const getMyEngagement = vi.fn();
const recordAuditEvent = vi.fn();
const putObject = vi.fn();
const deleteObject = vi.fn();
const dbInsert = vi.fn();
const dbSelect = vi.fn();
const dbUpdate = vi.fn();
const dbDelete = vi.fn();
let selectQueue: unknown[][] = [];
const inserted: unknown[] = [];

function chain(result: () => Promise<unknown[]>) {
  const c: Record<string, unknown> = {};
  for (const k of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy']) c[k] = () => c;
  c.limit = result;
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => result().then(res, rej);
  return c;
}

const db = {
  insert: (...args: unknown[]) => dbInsert(...args),
  select: (...args: unknown[]) => dbSelect(...args),
  update: (...args: unknown[]) => dbUpdate(...args),
  delete: (...args: unknown[]) => dbDelete(...args),
  transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
};

vi.mock('@/db/client', () => ({ db }));
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...args: unknown[]) => assertEngagementAccess(...args),
  getMyEngagement: (...args: unknown[]) => getMyEngagement(...args),
  checklistStateForViewer: (_ctx: unknown, s: unknown) => s,
  checklistStateFromRow: () => ({}),
}));
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
  listAuditEvents: vi.fn(async () => []),
}));
vi.mock('@/db/repositories/documents', () => ({ listDocuments: vi.fn(async () => []), getDocumentById: vi.fn() }));
vi.mock('@/db/repositories/board-resolution', () => ({ getBoardResolutionByEngagementId: vi.fn() }));
vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: vi.fn() }));
vi.mock('@/storage/s3', () => ({
  bucketKey: (bucket: string, path: string) => `${bucket}/${path}`,
  putObject: (...args: unknown[]) => putObject(...args),
  deleteObject: (...args: unknown[]) => deleteObject(...args),
  getObjectBuffer: vi.fn(),
  listObjects: vi.fn(),
  signedDownloadUrl: vi.fn(),
}));

const { recordNeedUploads, undoNeedUpload } = await import('@/db/repositories/client-home');
const { uploadRequestFiles, undoRequestUpload } = await import('@/db/repositories/client-documents');

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const REQ = '55555555-5555-5555-5555-555555555505';
const DOC_A = '66666666-6666-6666-6666-666666666601';
const DOC_B = '66666666-6666-6666-6666-666666666602';
const clientCtx: AuthContext = { userId: 'user-client', email: 'client@vcfo.local', name: 'Asha', role: 'client', clientId: 'c-a' };

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
  inserted.length = 0;
  deleteObject.mockResolvedValue(undefined);
  putObject.mockResolvedValue(undefined);
  dbSelect.mockImplementation(() => chain(() => Promise.resolve(selectQueue.shift() ?? [])));
  dbInsert.mockImplementation(() => ({
    values: (values: unknown) => {
      inserted.push(values);
      const list = Array.isArray(values) ? values : [values];
      return {
        returning: () => Promise.resolve(list.map((v, i) => ({ id: [DOC_A, DOC_B][i] ?? `id-${i}`, ...(v as object) }))),
      };
    },
  }));
  dbUpdate.mockImplementation(() => ({
    set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: REQ }]), then: (r: (v: unknown) => unknown) => Promise.resolve().then(r) }) }),
  }));
  dbDelete.mockImplementation(() => ({
    where: () => ({
      returning: () =>
        Promise.resolve([
          { id: DOC_A, objectKey: 'k-a' },
          { id: DOC_B, objectKey: 'k-b' },
        ]),
      then: (r: (v: unknown) => unknown) => Promise.resolve().then(r),
    }),
  }));
});

const files = [
  { objectKey: 'k-a', fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 10 },
  { objectKey: 'k-b', fileName: 'b.png', contentType: 'image/png', sizeBytes: 20 },
];

describe('recordNeedUploads (Home)', () => {
  it('gives a request of another engagement nothing and writes nothing', async () => {
    selectQueue = [[{ id: REQ, engagementId: OTHER, title: 'PAN copy', status: 'pending', stepId: null }]];
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    await expect(recordNeedUploads(clientCtx, REQ, files)).resolves.toBeNull();
    expect(dbInsert).not.toHaveBeenCalled();
    expect(dbUpdate).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('indexes every file against the approved engagement and audits the batch once', async () => {
    selectQueue = [[{ id: REQ, engagementId: OWN, title: 'PAN copy', status: 'pending', stepId: 'pre-15' }]];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    const out = await recordNeedUploads(clientCtx, REQ, files);
    expect(out?.documents.map((d) => d.documentId)).toEqual([DOC_A, DOC_B]);
    const rows = inserted[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.engagementId === OWN && r.uploadedBy === 'user-client' && r.sharedWithClient === true)).toBe(true);
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      clientCtx,
      expect.objectContaining({ action: 'client.need_uploaded', metadata: expect.objectContaining({ documentId: DOC_A, documentIds: [DOC_A, DOC_B] }) }),
    );
  });

  it('Undo of the first document removes the whole batch', async () => {
    selectQueue = [
      [{ engagementId: OWN, title: 'PAN copy' }],
      [{ id: 'audit-1', metadata: { requestId: REQ, documentId: DOC_A, documentIds: [DOC_A, DOC_B] } }],
    ];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    const out = await undoNeedUpload(clientCtx, REQ, DOC_A);
    expect(out?.objectKeys).toEqual(['k-a', 'k-b']);
    expect(recordAuditEvent).toHaveBeenCalledWith(clientCtx, expect.objectContaining({ action: 'client.need_upload_undone' }));
  });

  it('Undo refuses without the caller’s own audit record', async () => {
    selectQueue = [[{ engagementId: OWN, title: 'PAN copy' }], []];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await expect(undoNeedUpload(clientCtx, REQ, DOC_A)).resolves.toBeNull();
    expect(dbDelete).not.toHaveBeenCalled();
  });
});

describe('uploadRequestFiles (Documents)', () => {
  const bytes = Buffer.from('x');
  const pdf = { name: 'a.pdf', type: 'application/pdf', size: 1, bytes };
  const png = { name: 'b.png', type: 'image/png', size: 1, bytes };
  const exe = { name: 'c.exe', type: 'application/octet-stream', size: 1, bytes };

  it('refuses staff and gives a client with no engagement nothing', async () => {
    await expect(uploadRequestFiles({ ...clientCtx, role: 'intern' }, REQ, [pdf])).rejects.toThrow(/clients only/);
    getMyEngagement.mockResolvedValue(null);
    await expect(uploadRequestFiles(clientCtx, REQ, [pdf])).resolves.toBeNull();
    expect(putObject).not.toHaveBeenCalled();
  });

  it('reads a request of another engagement as not found', async () => {
    getMyEngagement.mockResolvedValue({ id: OWN });
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    selectQueue = [[]]; // the request id is not on the caller's engagement
    await expect(uploadRequestFiles(clientCtx, REQ, [pdf])).resolves.toBeNull();
    expect(putObject).not.toHaveBeenCalled();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('stores the good files in one batch and names the refused one', async () => {
    getMyEngagement.mockResolvedValue({ id: OWN });
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    selectQueue = [[{ id: REQ, engagementId: OWN, title: 'Bank statement', status: 'pending' }]];
    const out = await uploadRequestFiles(clientCtx, REQ, [pdf, exe, png]);
    expect(out?.fileIds).toEqual([DOC_A, DOC_B]);
    expect(out?.rejected).toEqual([{ fileName: 'c.exe', error: expect.stringContaining('c.exe') }]);
    expect(putObject).toHaveBeenCalledTimes(2);
    const rows = inserted[0] as Array<Record<string, unknown>>;
    expect(new Set(rows.map((r) => (r.uploadedAt as Date).getTime())).size).toBe(1);
    expect(rows.every((r) => r.engagementId === OWN && r.requestId === REQ)).toBe(true);
  });

  it('refuses a closed request', async () => {
    getMyEngagement.mockResolvedValue({ id: OWN });
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    selectQueue = [[{ id: REQ, engagementId: OWN, title: 'Bank statement', status: 'fulfilled' }]];
    await expect(uploadRequestFiles(clientCtx, REQ, [pdf])).rejects.toThrow(/not open/);
  });

  it('Undo removes every file of the batch', async () => {
    getMyEngagement.mockResolvedValue({ id: OWN });
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    const at = new Date();
    selectQueue = [
      [{ id: DOC_A, requestId: REQ, engagementId: OWN, uploadedBy: 'user-client', uploadedAt: at, objectKey: 'k-a' }],
      [{ id: REQ, status: 'fulfilled' }],
      [
        { id: DOC_A, objectKey: 'k-a' },
        { id: DOC_B, objectKey: 'k-b' },
      ],
    ];
    await expect(undoRequestUpload(clientCtx, REQ, DOC_A)).resolves.toBe(true);
    expect(deleteObject).toHaveBeenCalledWith('k-a');
    expect(deleteObject).toHaveBeenCalledWith('k-b');
  });
});
