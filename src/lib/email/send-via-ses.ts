import 'server-only';

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import {
  applyDevRedirect,
  extractEmailAddress,
  normalizeAddresses,
  resolveFromEmail,
  type SendEmailInput,
  type SendEmailResult,
} from '@/lib/email/send-email-shared';

/**
 * AWS SES v2 transport — used when EMAIL_PROVIDER=ses.
 *
 * Identity: verify domain (or address) in SES in SES_REGION / S3_REGION / ap-south-1.
 * New accounts start in sandbox (verified recipients only) until production access.
 * Credentials: App Runner / ECS instance role preferred; else default AWS SDK chain.
 */
function sesClient(): SESv2Client {
  const region =
    process.env.SES_REGION?.trim() ||
    process.env.S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    'ap-south-1';
  return new SESv2Client({ region });
}

export async function sendViaSes(input: SendEmailInput): Promise<SendEmailResult> {
  const from = resolveFromEmail(input.from);
  const purpose = input.purpose ?? 'email';

  let to = normalizeAddresses(input.to);
  let cc = normalizeAddresses(input.cc);
  const replyTo = normalizeAddresses(input.replyTo).map(extractEmailAddress);
  let subject = input.subject;

  const redirected = applyDevRedirect({ to, cc, subject, purpose });
  to = redirected.to;
  cc = redirected.cc;
  subject = redirected.subject;
  const { redirectedTo, intendedTo } = redirected;

  if (!from) {
    console.log(`[ses] skipped (${purpose}) — EMAIL_FROM / SES_FROM_EMAIL / RESEND_FROM_EMAIL empty`, {
      to,
      cc,
      reply_to: replyTo,
      subject,
      text: input.text,
      intendedTo,
    });
    return {
      ok: false,
      skipped: true,
      error: 'email_not_configured',
      redirectedTo,
      intendedTo,
      provider: 'ses',
    };
  }

  try {
    const client = sesClient();
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: {
          ToAddresses: to.map(extractEmailAddress),
          ...(cc.length > 0 ? { CcAddresses: cc.map(extractEmailAddress) } : {}),
        },
        ...(replyTo.length > 0 ? { ReplyToAddresses: replyTo } : {}),
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: input.html, Charset: 'UTF-8' },
              Text: { Data: input.text, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
    return { ok: true, redirectedTo, intendedTo, provider: 'ses' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ses_request_failed';
    console.error(`[ses] ${purpose} request failed`, message);
    return { ok: false, error: message, redirectedTo, intendedTo, provider: 'ses' };
  }
}
