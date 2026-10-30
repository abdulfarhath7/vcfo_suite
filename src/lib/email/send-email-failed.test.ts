import { beforeEach, describe, expect, it, vi } from 'vitest';

/** P-321: only a refused mail is kept for retry; sent and skipped mail are never stored. */

const kept: Array<Record<string, unknown>> = [];
let answer: { ok: boolean; skipped?: boolean; error?: string } = { ok: true };

vi.mock('@/lib/email/send-via-resend', () => ({ sendViaResend: async () => answer }));
vi.mock('@/lib/email/send-via-ses', () => ({ sendViaSes: async () => answer }));
vi.mock('@/db/repositories/failed-emails', () => ({
  systemRecordFailedEmail: async (row: Record<string, unknown>) => {
    kept.push(row);
  },
}));

const { sendEmail, sendEmailNoLog } = await import('./send-email');

const mail = { to: 'a@x.in', subject: 'Hello', html: '<p>Hi</p>', text: 'Hi', purpose: 'welcome' };

beforeEach(() => {
  kept.length = 0;
});

describe('sendEmail keeps failures only', () => {
  it('keeps a refused mail with its render and error', async () => {
    answer = { ok: false, error: 'Rejected' };
    const res = await sendEmail(mail);
    expect(res.ok).toBe(false);
    expect(kept).toEqual([
      { to: ['a@x.in'], cc: [], replyTo: [], from: null, subject: 'Hello', templateKey: 'welcome', html: '<p>Hi</p>', text: 'Hi', hadAttachments: false, error: 'Rejected' },
    ]);
  });

  it('never keeps a sent or skipped mail', async () => {
    answer = { ok: true };
    await sendEmail(mail);
    answer = { ok: false, skipped: true };
    await sendEmail(mail);
    expect(kept).toHaveLength(0);
  });

  it('the no-log send never keeps anything', async () => {
    answer = { ok: false, error: 'Rejected' };
    await sendEmailNoLog(mail);
    expect(kept).toHaveLength(0);
  });
});
