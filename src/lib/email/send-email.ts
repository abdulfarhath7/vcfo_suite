import 'server-only';

import {
  resolveEmailProvider,
  type SendEmailInput,
  type SendEmailResult,
} from '@/lib/email/send-email-shared';
import { sendViaResend } from '@/lib/email/send-via-resend';
import { sendViaSes } from '@/lib/email/send-via-ses';

export type {
  EmailAttachment,
  SendEmailInput,
  SendEmailResult,
} from '@/lib/email/send-email-shared';

export {
  formatReplyTo,
  formatFromWithSender,
  companyFromAddress,
} from '@/lib/email/send-email-shared';

/**
 * Single outbound email entry point.
 *
 * - EMAIL_PROVIDER=resend (default) → Resend API
 * - EMAIL_PROVIDER=ses → AWS SES v2
 *
 * Local/dev: missing API key / From → console skip (ok: false, skipped: true).
 *
 * `attachments` is optional; both transports send it (Resend as base64 `attachments`, SES v2
 * as `Simple.Attachments`). Callers that pass none get exactly the old request.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const result = await sendEmailNoLog(input);
  if (!result.ok && !result.skipped) await keepFailedEmail(input, result);
  return result;
}

/**
 * The same send without keeping a failure: for the developer console's retry and test send,
 * which record their own outcome.
 */
export async function sendEmailNoLog(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = resolveEmailProvider();
  if (provider === 'ses') return sendViaSes(input);
  return sendViaResend(input);
}

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Keep a refused mail for 30 days so the developer console can retry it (P-321). Only
 * failures are kept. A failure to keep it is logged and never changes the send's result.
 */
async function keepFailedEmail(input: SendEmailInput, result: SendEmailResult): Promise<void> {
  try {
    const { systemRecordFailedEmail } = await import('@/db/repositories/failed-emails');
    await systemRecordFailedEmail({
      to: list(input.to),
      cc: input.cc ?? [],
      replyTo: list(input.replyTo),
      from: input.from ?? null,
      subject: input.subject,
      templateKey: input.purpose ?? null,
      html: input.html,
      text: input.text,
      hadAttachments: Boolean(input.attachments?.length),
      error: result.error ?? null,
    });
  } catch (err) {
    console.warn('[email] could not keep the failed mail', err instanceof Error ? err.message : err);
  }
}

