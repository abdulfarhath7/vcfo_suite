import { isRetryableTwilioCode } from '@/lib/notify/send-whatsapp-twilio';
import type { WhatsAppProvider } from '@/lib/notify/channels';

/**
 * Should the Inngest job throw (letting Inngest back off and retry) or accept
 * a failure and stop?
 *
 * The bias is deliberate and matches the Twilio path that came first: an
 * UNRECOGNISED code is retryable. A transient outage that we fail to classify
 * costs three attempts; a permanent error that we wrongly treat as permanent
 * silently drops a real notification.
 *
 * The inverse — retrying something that can never succeed — is what the
 * non-retryable sets below exist to prevent: an invalid number, a rejected
 * template or an opted-out recipient will fail identically on every attempt.
 */

/**
 * EUM surfaces send errors as SDK exception names; Meta's numeric codes come
 * back on the SNS status events and inside some exception messages. Both are
 * accepted here, so the caller never has to know which it holds.
 */
const EUM_NON_RETRYABLE = new Set([
  // AWS SDK exception names — client faults that will not change on a retry.
  'validationexception',
  'invalidparametersexception',
  'resourcenotfoundexception',
  'accessdeniedexception',
  'accessdeniedbymetaexception',

  // Meta Cloud API error codes.
  '100', // invalid parameter
  '131026', // message undeliverable / recipient is not a WhatsApp user
  '131047', // re-engagement outside the allowed window
  '131049', // per-user marketing limit
  '132000', // template param count mismatch
  '132001', // template does not exist
  '132005', // template hydrated text too long
  '132007', // template format character policy violated
  '132012', // template parameter format mismatch
  '132015', // template is paused
  '132016', // template is disabled
  '132068', // flow is blocked
  '132069', // flow is throttled
]);

/**
 * Explicitly retryable EUM codes. Listed for the reader rather than for the
 * logic — anything not in the non-retryable set already retries — so a future
 * reader can see which failures were expected to be transient.
 */
const EUM_RETRYABLE = new Set([
  'throttledrequestexception',
  'limitexceededexception',
  'internalserviceexception',
  'dependencyexception',
  '1', // unknown / transient API error
  '2', // temporary service outage
  '130429', // rate limit hit
  '131048', // spam rate limit hit
  '133016', // temporary account block
  '368', // temporarily blocked for policy violations
]);

export function isRetryableEumCode(code: string | undefined): boolean {
  const key = code?.trim().toLowerCase();
  if (!key) return true;
  if (EUM_RETRYABLE.has(key)) return true;
  return !EUM_NON_RETRYABLE.has(key);
}

/** Provider-aware retry decision for the Inngest job. */
export function isRetryableWhatsAppError(
  provider: WhatsAppProvider,
  code: string | undefined,
): boolean {
  return provider === 'aws_eum' ? isRetryableEumCode(code) : isRetryableTwilioCode(code);
}
