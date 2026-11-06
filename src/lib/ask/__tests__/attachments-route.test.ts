// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const putObject = vi.fn(async (..._a: unknown[]) => undefined);
const createAskAttachment = vi.fn(async (_ctx: unknown, input: { fileName: string }) => ({ id: 'a-1', fileName: input.fileName }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ask/route-guard', () => ({ requireAsk: async () => ({ ok: true, ctx: { userId: 'u-1' } }) }));
vi.mock('@/db/repositories/ask-attachments', () => ({ createAskAttachment: (...a: [unknown, { fileName: string }]) => createAskAttachment(...a) }));
vi.mock('@/storage/s3', () => ({ putObject: (...a: unknown[]) => putObject(...a) }));

const { POST } = await import('../../../../app/api/ask/attachments/route');

const upload = (name: string, body: string, type: string) => {
  const form = new FormData();
  form.set('file', new File([body], name, { type }));
  return POST(new Request('http://x.test/api/ask/attachments', { method: 'POST', body: form }));
};

beforeEach(() => vi.clearAllMocks());

describe('POST /api/ask/attachments', () => {
  it('stores a file under the type its name and bytes show, whatever the browser says', async () => {
    const res = await upload('note.txt', 'Plain words', 'text/html');
    expect(res.status).toBe(200);
    expect(putObject.mock.calls[0]![2]).toBe('text/plain');
    expect(createAskAttachment.mock.calls[0]![1]).toMatchObject({ contentType: 'text/plain' });
  });

  it('refuses a file that is not what its name says, and stores nothing', async () => {
    const res = await upload('report.pdf', '<html><script>alert(1)</script></html>', 'application/pdf');
    expect(res.status).toBe(400);
    expect(putObject).not.toHaveBeenCalled();
    expect(createAskAttachment).not.toHaveBeenCalled();
  });
});
