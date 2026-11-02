import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Attachments on the outbound email path (G-21 scheduled reports). Both transports carry the
 * file, and a send without attachments builds the same request as before.
 */

const sesSend = vi.fn();
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class {
    send = sesSend;
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { sendViaResend } = await import('./send-via-resend');
const { sendViaSes } = await import('./send-via-ses');

const PDF = new Uint8Array([37, 80, 68, 70]); // "%PDF"
const base = { to: 'partner@sbc.in', subject: 'Report', html: '<p>Hi</p>', text: 'Hi', purpose: 'test' };

const env = { ...process.env };
beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'VCFO Suite <noreply@sbctrack.in>';
  delete process.env.EMAIL_DEV_REDIRECT_TO;
  delete process.env.RESEND_DEV_REDIRECT_TO;
  sesSend.mockReset().mockResolvedValue({});
});
afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});

describe('Resend', () => {
  it('sends attachments as base64', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'm1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await sendViaResend({
      ...base,
      attachments: [{ filename: 'report.pdf', content: PDF, contentType: 'application/pdf' }],
    });
    expect(res.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.attachments).toEqual([
      { filename: 'report.pdf', content: Buffer.from(PDF).toString('base64'), content_type: 'application/pdf' },
    ]);
  });

  it('leaves the request unchanged without attachments', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendViaResend(base);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).not.toHaveProperty('attachments');
  });
});

describe('SES', () => {
  it('sends attachments on the simple message', async () => {
    await sendViaSes({ ...base, attachments: [{ filename: 'report.pdf', content: PDF, contentType: 'application/pdf' }] });
    const input = (sesSend.mock.calls[0]![0] as { input: { Content: { Simple: Record<string, unknown> } } }).input;
    expect(input.Content.Simple.Attachments).toEqual([
      {
        FileName: 'report.pdf',
        RawContent: PDF,
        ContentType: 'application/pdf',
        ContentDisposition: 'ATTACHMENT',
        ContentTransferEncoding: 'BASE64',
      },
    ]);
  });

  it('leaves the message unchanged without attachments', async () => {
    await sendViaSes(base);
    const input = (sesSend.mock.calls[0]![0] as { input: { Content: { Simple: Record<string, unknown> } } }).input;
    expect(input.Content.Simple).not.toHaveProperty('Attachments');
  });
});
