import type { DeliveryStatus } from '@/lib/notify/types';

/**
 * Parsing for the events AWS End User Messaging publishes to SNS.
 *
 * PURE — no db, no network, no env — so the hostile-input cases can be tested
 * directly. The route above it does the verification and the writes.
 *
 * EUM wraps Meta's own webhook payload: the SNS `Message` is a JSON string
 * whose `whatsAppWebhookEntry` is *itself* a JSON string holding the Meta
 * entry. Everything here treats that structure as untrusted and returns empty
 * results rather than throwing, because a parse failure must acknowledge the
 * event (a 500 makes SNS retry a payload that will never parse).
 *
 * OUTBOUND-ONLY: an inbound message yields nothing but the sender's number and
 * whether the text was an opt-out keyword. No message body is returned,
 * logged, or persisted anywhere.
 */

type EumStatusEvent = {
  /** Meta's message id — the same wamid stored as `providerMessageId`. */
  wamid: string;
  status: DeliveryStatus;
  /** Recipient in Meta's bare-digit form. */
  recipientId: string | null;
  /** First Meta error code, when the status is a failure. */
  errorCode: string | null;
};

type EumInboundEvent = {
  /** Sender in Meta's bare-digit form. */
  from: string;
  /** The body is NOT carried; only the opt-out verdict crosses this boundary. */
  isOptOut: boolean;
};

export type EumWebhookEvents = {
  statuses: EumStatusEvent[];
  inbound: EumInboundEvent[];
};

const EMPTY: EumWebhookEvents = { statuses: [], inbound: [] };

/** Meta message status → our delivery status. */
export function metaStatusToDeliveryStatus(value: unknown): DeliveryStatus | null {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'accepted':
    case 'queued':
      return 'queued';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
      return 'failed';
    default:
      // `deleted` and anything unrecognised advance nothing.
      return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Tolerate a JSON string or an already-parsed object at any nesting level. */
function parseMaybeJson(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

function firstErrorCode(entry: Record<string, unknown>): string | null {
  const [first] = asArray(entry.errors);
  const error = asRecord(first);
  if (!error) return null;
  const code = error.code;
  return typeof code === 'number' || typeof code === 'string' ? String(code) : null;
}

/**
 * Extract status and inbound events from one SNS `Message` body.
 *
 * `isOptOut` is decided by the caller's keyword test, passed in so this module
 * stays free of the opt-out vocabulary and the phone helpers.
 */
export function parseEumWebhookEvents(
  snsMessageBody: unknown,
  isOptOutKeyword: (body: string | null | undefined) => boolean,
): EumWebhookEvents {
  const envelope = parseMaybeJson(snsMessageBody);
  if (!envelope) return EMPTY;

  const entry = parseMaybeJson(envelope.whatsAppWebhookEntry) ?? envelope;
  const statuses: EumStatusEvent[] = [];
  const inbound: EumInboundEvent[] = [];

  for (const rawChange of asArray(entry.changes)) {
    const change = asRecord(rawChange);
    const value = asRecord(change?.value);
    if (!value) continue;

    for (const rawStatus of asArray(value.statuses)) {
      const row = asRecord(rawStatus);
      if (!row) continue;
      const wamid = typeof row.id === 'string' ? row.id.trim() : '';
      const status = metaStatusToDeliveryStatus(row.status);
      if (!wamid || !status) continue;
      statuses.push({
        wamid,
        status,
        recipientId:
          typeof row.recipient_id === 'string' ? row.recipient_id.trim() || null : null,
        errorCode: firstErrorCode(row),
      });
    }

    for (const rawMessage of asArray(value.messages)) {
      const row = asRecord(rawMessage);
      if (!row) continue;
      const from = typeof row.from === 'string' ? row.from.trim() : '';
      if (!from) continue;
      const text = asRecord(row.text);
      const body = typeof text?.body === 'string' ? text.body : null;
      // Only the verdict leaves this function — never the body itself.
      inbound.push({ from, isOptOut: isOptOutKeyword(body) });
    }
  }

  return { statuses, inbound };
}
