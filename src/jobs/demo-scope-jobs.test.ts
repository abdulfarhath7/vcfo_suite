// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN H2 jobs and storage: an event sent inside a demo scope carries `demo: true`; the Inngest
 * route runs a demo event inside the demo scope; a demo event that reaches a job outside the
 * scope is refused; and S3 keys written inside a demo scope get the `demo/` prefix.
 */
const { runInDemo, isDemoScope } = await import('@/db/demo-scope');
const { demoScopeMiddleware } = await import('./client');
const { scopedInngestHandler } = await import('./demo-route');

type Hooks = {
  onSendEvent: () => { transformInput: (a: { payloads: Array<{ name: string; data?: Record<string, unknown> }> }) => Promise<{ payloads: unknown[] } | undefined> };
  onFunctionRun: (a: { ctx: { event: { data?: Record<string, unknown> } } }) => { transformInput: () => Promise<void> };
};
const hooks = (await (demoScopeMiddleware as unknown as { init: (a: unknown) => Hooks | Promise<Hooks> }).init({ client: {} })) as Hooks;

describe('Inngest events and the demo scope', () => {
  const payloads = [{ name: 'ask/fill.requested', data: { runId: 'r1' } }];

  it('an event sent inside a demo scope carries demo: true', async () => {
    const out = await runInDemo(() => hooks.onSendEvent().transformInput({ payloads }));
    expect(out).toEqual({ payloads: [{ name: 'ask/fill.requested', data: { runId: 'r1', demo: true } }] });
  });

  it('an event sent outside is left as it is', async () => {
    expect(await hooks.onSendEvent().transformInput({ payloads })).toBeUndefined();
  });

  it('a demo event outside the demo scope is refused before the job body runs', async () => {
    await expect(hooks.onFunctionRun({ ctx: { event: { data: { demo: true } } } }).transformInput()).rejects.toThrow(/outside the demo scope/);
    await expect(runInDemo(() => hooks.onFunctionRun({ ctx: { event: { data: { demo: true } } } }).transformInput())).resolves.toBeUndefined();
    await expect(hooks.onFunctionRun({ ctx: { event: { data: {} } } }).transformInput()).resolves.toBeUndefined();
  });

  it('the route runs a demo event inside the demo scope and any other call in the main scope', async () => {
    const seen: boolean[] = [];
    const handler = scopedInngestHandler(async (req: Request, _ctx: unknown) => {
      seen.push(await isDemoScope());
      // The body must still be readable by the SDK after the peek.
      const body = (await req.json()) as { event: { name: string } };
      return new Response(body.event.name);
    }) as (req: Request, ctx: unknown) => Promise<Response>;
    const post = (data: Record<string, unknown>) =>
      handler(new Request('http://x/api/inngest', { method: 'POST', body: JSON.stringify({ event: { name: 'e', data }, steps: {} }) }), {} as never);
    expect(await (await post({ demo: true })).text()).toBe('e');
    await post({});
    await handler(new Request('http://x/api/inngest', { method: 'POST', body: 'not json' }), {} as never).catch(() => undefined);
    expect(seen.slice(0, 2)).toEqual([true, false]);
    expect(seen[2]).toBe(false);
  });
});

/* ---- S3 ---- */
const sent: Array<{ type: string; Key?: string; Prefix?: string }> = [];
let listed: string[] = [];
vi.mock('@aws-sdk/client-s3', () => {
  class Cmd {
    constructor(public input: Record<string, unknown>) {}
  }
  const named = (type: string) =>
    class extends Cmd {
      type = type;
    };
  return {
    S3Client: class {
      async send(cmd: Cmd & { type: string }) {
        sent.push({ type: cmd.type, Key: cmd.input.Key as string | undefined, Prefix: cmd.input.Prefix as string | undefined });
        if (cmd.type === 'list') return { Contents: listed.map((Key) => ({ Key, Size: 1 })), IsTruncated: false };
        if (cmd.type === 'get') return { Body: { transformToByteArray: async () => new Uint8Array([1]) } };
        return {};
      }
    },
    PutObjectCommand: named('put'),
    GetObjectCommand: named('get'),
    DeleteObjectCommand: named('delete'),
    HeadObjectCommand: named('head'),
    ListObjectsV2Command: named('list'),
  };
});
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: async (_c: unknown, cmd: { input: { Key: string } }) => `https://s3/${cmd.input.Key}`,
}));

const s3 = await import('@/storage/s3');

describe('S3 keys in the demo scope', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('writes, reads, checks, signs and deletes under demo/ inside a demo scope', async () => {
    await runInDemo(async () => {
      await s3.putObject('engagement-documents/e1/a.pdf', 'x');
      await s3.getObjectBuffer('engagement-documents/e1/a.pdf');
      await s3.objectExists('engagement-documents/e1/a.pdf');
      expect(await s3.signedDownloadUrl('engagement-documents/e1/a.pdf')).toBe('https://s3/demo/engagement-documents/e1/a.pdf');
      await s3.deleteObject('engagement-documents/e1/a.pdf');
    });
    expect(sent.map((c) => c.Key)).toEqual(Array(4).fill('demo/engagement-documents/e1/a.pdf'));
  });

  it('leaves keys alone outside a demo scope', async () => {
    await s3.putObject('engagement-documents/e1/a.pdf', 'x');
    expect(await s3.signedDownloadUrl('engagement-documents/e1/a.pdf')).toBe('https://s3/engagement-documents/e1/a.pdf');
    expect(sent.map((c) => c.Key)).toEqual(['engagement-documents/e1/a.pdf']);
  });

  it('lists under demo/ and hands back the keys without the prefix', async () => {
    listed = ['demo/milestone-documents/e1/f/1.pdf', 'demo/milestone-documents/e1/f/2.pdf'];
    const out = await runInDemo(() => s3.listObjects('milestone-documents/e1/f/'));
    expect(sent[0]).toMatchObject({ type: 'list', Prefix: 'demo/milestone-documents/e1/f/' });
    expect(out.map((o) => o.key)).toEqual(['milestone-documents/e1/f/1.pdf', 'milestone-documents/e1/f/2.pdf']);
  });
});
