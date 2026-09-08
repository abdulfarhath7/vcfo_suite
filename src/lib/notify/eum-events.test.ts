import { describe, expect, it } from 'vitest';
import {
  metaStatusToDeliveryStatus,
  parseEumWebhookEvents,
} from '@/lib/notify/eum-events';
import { isOptOutKeyword } from '@/lib/notify/phone';

/**
 * The SNS payload is attacker-shaped input: it arrives on a public URL and is
 * nested JSON-inside-JSON. These tests cover the real EUM envelope and the
 * malformed variants that must be acknowledged rather than crash the route.
 */

function envelope(entry: unknown) {
  // EUM wraps Meta's entry as a JSON string inside the SNS Message body.
  return JSON.stringify({
    context: { MetaWabaIds: ['waba-1'] },
    whatsAppWebhookEntry: JSON.stringify(entry),
  });
}

const parse = (body: unknown) => parseEumWebhookEvents(body, isOptOutKeyword);

describe('metaStatusToDeliveryStatus', () => {
  it('maps the Meta vocabulary onto delivery statuses', () => {
    expect(metaStatusToDeliveryStatus('sent')).toBe('sent');
    expect(metaStatusToDeliveryStatus('delivered')).toBe('delivered');
    expect(metaStatusToDeliveryStatus('read')).toBe('read');
    expect(metaStatusToDeliveryStatus('failed')).toBe('failed');
    expect(metaStatusToDeliveryStatus('accepted')).toBe('queued');
    // `deleted` and anything unknown advance nothing.
    expect(metaStatusToDeliveryStatus('deleted')).toBeNull();
    expect(metaStatusToDeliveryStatus(undefined)).toBeNull();
  });
});

describe('parseEumWebhookEvents', () => {
  it('reads statuses out of the nested EUM envelope', () => {
    const body = envelope({
      id: 'waba-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '919000000000' },
            statuses: [
              { id: 'wamid.A', status: 'delivered', recipient_id: '919876543210' },
              { id: 'wamid.B', status: 'read', recipient_id: '919876543211' },
            ],
          },
        },
      ],
    });

    expect(parse(body)).toEqual({
      statuses: [
        { wamid: 'wamid.A', status: 'delivered', recipientId: '919876543210', errorCode: null },
        { wamid: 'wamid.B', status: 'read', recipientId: '919876543211', errorCode: null },
      ],
      inbound: [],
    });
  });

  it('carries the first Meta error code on a failure', () => {
    const body = envelope({
      changes: [
        {
          value: {
            statuses: [
              {
                id: 'wamid.C',
                status: 'failed',
                recipient_id: '919876543210',
                errors: [{ code: 131026, title: 'Message undeliverable' }],
              },
            ],
          },
        },
      ],
    });
    expect(parse(body).statuses[0]).toEqual({
      wamid: 'wamid.C',
      status: 'failed',
      recipientId: '919876543210',
      errorCode: '131026',
    });
  });

  it('returns the opt-out verdict and never the message body', () => {
    const body = envelope({
      changes: [
        {
          value: {
            messages: [
              { from: '919876543210', type: 'text', text: { body: 'STOP' } },
              { from: '919876543211', type: 'text', text: { body: 'when is my GST due?' } },
            ],
          },
        },
      ],
    });

    const result = parse(body);
    expect(result.inbound).toEqual([
      { from: '919876543210', isOptOut: true },
      { from: '919876543211', isOptOut: false },
    ]);
    // The parsed result must not carry any message text at all.
    expect(JSON.stringify(result)).not.toContain('GST');
  });

  it('accepts an already-parsed entry as well as a JSON string', () => {
    const entry = { changes: [{ value: { statuses: [{ id: 'wamid.D', status: 'sent' }] } }] };
    expect(parse(JSON.stringify({ whatsAppWebhookEntry: entry })).statuses).toHaveLength(1);
    // Some payloads arrive without the EUM wrapper at all.
    expect(parse(JSON.stringify(entry)).statuses).toHaveLength(1);
  });

  it('yields nothing for malformed or hostile input instead of throwing', () => {
    const empty = { statuses: [], inbound: [] };
    expect(parse('not json')).toEqual(empty);
    expect(parse(undefined)).toEqual(empty);
    expect(parse(JSON.stringify({ whatsAppWebhookEntry: 'not json' }))).toEqual(empty);
    expect(parse(JSON.stringify({ changes: 'nope' }))).toEqual(empty);
    expect(parse(JSON.stringify({ changes: [null, 7, { value: null }] }))).toEqual(empty);
    expect(
      parse(envelope({ changes: [{ value: { statuses: [{ status: 'delivered' }] } }] })),
    ).toEqual(empty);
    expect(
      parse(envelope({ changes: [{ value: { messages: [{ type: 'text' }] } }] })),
    ).toEqual(empty);
  });
});
