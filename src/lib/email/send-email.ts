import 'server-only';

import {
  resolveEmailProvider,
  type SendEmailInput,
  type SendEmailResult,
} from '@/lib/email/send-email-shared';
import { sendViaResend } from '@/lib/email/send-via-resend';
import { sendViaSes } from '@/lib/email/send-via-ses';

export type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
  SendResendEmailInput,
  SendResendResult,
} from '@/lib/email/send-email-shared';

export {
  formatReplyTo,
  defaultReplyToFromEnv,
  resolveEmailDevRedirect,
  resolveResendDevRedirect,
  resolveEmailProvider,
  resolveFromEmail,
} from '@/lib/email/send-email-shared';

/**
 * Single outbound email entry point.
 *
 * - EMAIL_PROVIDER=resend (default) → Resend API
 * - EMAIL_PROVIDER=ses → AWS SES v2
 *
 * Local/dev: missing API key / From → console skip (ok: false, skipped: true).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = resolveEmailProvider();
  if (provider === 'ses') return sendViaSes(input);
  return sendViaResend(input);
}

/** @deprecated Prefer sendEmail — identical dispatcher kept for existing call sites. */
export async function sendResendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  return sendEmail(input);
}
