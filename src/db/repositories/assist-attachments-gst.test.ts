import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * GST REG-01 documents on the VCFO Assist attachments route: the extension reads them only here
 * (no signed S3 URLs), under the GST profile's access rule, with the same 6 MB limit.
 */

vi.mock('server-only', () => ({}));
const gstDocumentStorageKey = vi.fn();
const getSpiceAttachments = vi.fn();
const listObjects = vi.fn();
const getObjectBuffer = vi.fn();
vi.mock('@/db/repositories/gst-profile', () => ({ gstDocumentStorageKey: (...a: unknown[]) => gstDocumentStorageKey(...a) }));
vi.mock('@/db/repositories/spice-attachments', () => ({ getSpiceAttachments: (...a: unknown[]) => getSpiceAttachments(...a) }));
vi.mock('@/db/repositories/doc-pack', () => ({ getDocPackInputs: vi.fn() }));
vi.mock('@/db/repositories/documents', () => ({ getDocumentById: vi.fn() }));
vi.mock('@/storage/s3', () => ({
  bucketKey: (b: string, p: string) => `${b}/${p}`,
  listObjects: (...a: unknown[]) => listObjects(...a),
  getObjectBuffer: (...a: unknown[]) => getObjectBuffer(...a),
}));

const { readAssistAttachment, MAX_ATTACHMENT_BYTES } = await import('@/db/repositories/assist-attachments');

const DB = '11111111-1111-4111-8111-111111111111';
const KEY = `milestone-documents/${DB}/recentPhotographUrl/1700000000000-asha.jpg`;
const lead: AuthContext = { userId: 'u', email: 'u@x', name: 'U', role: 'intern', internId: 'i' };

beforeEach(() => {
  vi.clearAllMocks();
  gstDocumentStorageKey.mockResolvedValue({ ok: true, dbId: DB, label: 'Photograph of Asha', storageKey: KEY });
  listObjects.mockResolvedValue([{ key: KEY, size: 40_000 }]);
  getObjectBuffer.mockResolvedValue(Buffer.from('jpeg'));
});

describe('readAssistAttachment with a GST key', () => {
  it('serves the file through the GST profile, not the SPICe+ slots', async () => {
    const out = await readAssistAttachment(lead, DB, 'promoter.1.photo');
    expect(out).toMatchObject({ ok: true, dbId: DB, fileName: 'asha.jpg', contentType: 'image/jpeg' });
    expect(gstDocumentStorageKey).toHaveBeenCalledWith(lead, DB, 'promoter.1.photo');
    expect(getSpiceAttachments).not.toHaveBeenCalled();
  });

  it('passes the scope refusal through, and refuses a client before any read', async () => {
    gstDocumentStorageKey.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    expect(await readAssistAttachment(lead, DB, 'company.coi')).toEqual({ ok: false, status: 403, error: 'forbidden' });
    gstDocumentStorageKey.mockClear();
    expect(await readAssistAttachment({ ...lead, role: 'client' }, DB, 'company.coi')).toEqual({ ok: false, status: 403, error: 'forbidden' });
    expect(gstDocumentStorageKey).not.toHaveBeenCalled();
  });

  it('answers no_file when storage has nothing, and refuses a file over the limit unread', async () => {
    listObjects.mockResolvedValue([]);
    expect(await readAssistAttachment(lead, DB, 'place.proof')).toEqual({ ok: false, status: 404, error: 'no_file' });
    listObjects.mockResolvedValue([{ key: KEY, size: MAX_ATTACHMENT_BYTES + 1 }]);
    expect(await readAssistAttachment(lead, DB, 'place.proof')).toEqual({ ok: false, status: 413, error: 'file_too_large' });
    expect(getObjectBuffer).not.toHaveBeenCalled();
  });
});
