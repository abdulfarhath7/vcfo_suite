// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Demo logins (src/lib/demo-logins.ts): mail naming a demo mailbox is logged, never sent. */
const resend = vi.fn(async () => ({ ok: true }));
const ses = vi.fn(async () => ({ ok: true }));
vi.mock('@/lib/email/send-via-resend', () => ({ sendViaResend: (...a: unknown[]) => resend(...(a as [])) }));
vi.mock('@/lib/email/send-via-ses', () => ({ sendViaSes: (...a: unknown[]) => ses(...(a as [])) }));
let demoRequest = false;
vi.mock('@/lib/demo-request', () => ({ isDemoRequest: async () => demoRequest, markDemoRequest: async () => undefined }));

const { sendEmailNoLog, demoEmailReason } = await import('./send-email');
const base = { subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

beforeEach(() => {
  resend.mockClear();
  ses.mockClear();
  demoRequest = false;
});

describe('outbound email for demo logins', () => {
  it.each([
    ['to', { to: 'client@vcfosuite.com' }],
    ['cc', { to: 'real@sbcllp.in', cc: ['lead@vcfosuite.com'] }],
    ['reply-to', { to: 'real@sbcllp.in', replyTo: 'Arjun Rao <lead@vcfosuite.com>' }],
  ])('a demo mailbox in %s is not sent', async (_where, extra) => {
    const r = await sendEmailNoLog({ ...base, ...extra });
    expect(r).toMatchObject({ ok: false, skipped: true, error: 'demo_login' });
    expect(resend).not.toHaveBeenCalled();
    expect(ses).not.toHaveBeenCalled();
  });

  it('a mail started inside a demo request is not sent, even to a real address', async () => {
    demoRequest = true;
    const r = await sendEmailNoLog({ ...base, to: 'real@sbcllp.in' });
    expect(r.skipped).toBe(true);
    expect(resend).not.toHaveBeenCalled();
  });

  it('real mail still goes out', async () => {
    expect(await demoEmailReason({ to: 'real@sbcllp.in' })).toBeNull();
    await sendEmailNoLog({ ...base, to: 'real@sbcllp.in' });
    expect(resend.mock.calls.length + ses.mock.calls.length).toBe(1);
  });
});
