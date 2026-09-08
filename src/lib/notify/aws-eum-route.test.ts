import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The SNS route's wiring: verification gates every write, statuses advance the
 * delivery row keyed by wamid, and an opt-out is stamped on the E.164 number
 * rather than Meta's bare-digit form.
 *
 * The signature algorithm itself is proven in `aws-sns-verify.test.ts` with a
 * real keypair; here it is stubbed so each case can choose verified or not.
 */

const verifySnsSignature = vi.fn();
const confirmSnsSubscription = vi.fn();
const systemUpdateDeliveryByProviderId = vi.fn();
const systemMarkWhatsAppStatus = vi.fn();
const systemRecordWhatsAppOptOut = vi.fn();

vi.mock('@/lib/notify/aws-sns-verify', () => ({
  verifySnsSignature: (...args: unknown[]) => verifySnsSignature(...args),
  confirmSnsSubscription: (...args: unknown[]) => confirmSnsSubscription(...args),
}));
vi.mock('@/db/repositories/notification-deliveries', () => ({
  systemUpdateDeliveryByProviderId: (...args: unknown[]) =>
    systemUpdateDeliveryByProviderId(...args),
}));
vi.mock('@/db/repositories/profiles', () => ({
  systemMarkWhatsAppStatus: (...args: unknown[]) => systemMarkWhatsAppStatus(...args),
  systemRecordWhatsAppOptOut: (...args: unknown[]) => systemRecordWhatsAppOptOut(...args),
}));

const { POST } = await import('../../../app/api/webhooks/aws-eum/route');

const TOPIC = 'arn:aws:sns:ap-south-1:123456789012:vcfo-eum';

function post(body: unknown): Request {
  return new Request('https://app.test/api/webhooks/aws-eum', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function notification(entry: unknown) {
  return {
    Type: 'Notification',
    TopicArn: TOPIC,
    MessageId: 'm-1',
    Message: JSON.stringify({ whatsAppWebhookEntry: JSON.stringify(entry) }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  verifySnsSignature.mockResolvedValue(true);
  confirmSnsSubscription.mockResolvedValue(true);
  delete process.env.AWS_EUM_SNS_TOPIC_ARN;
});

afterEach(() => {
  delete process.env.AWS_EUM_SNS_TOPIC_ARN;
});

describe('POST /api/webhooks/aws-eum', () => {
  it('rejects an unverified request with 403 and touches nothing', async () => {
    verifySnsSignature.mockResolvedValue(false);
    const res = await POST(
      post(notification({ changes: [{ value: { statuses: [{ id: 'w1', status: 'read' }] } }] })),
    );
    expect(res.status).toBe(403);
    expect(systemUpdateDeliveryByProviderId).not.toHaveBeenCalled();
    expect(systemMarkWhatsAppStatus).not.toHaveBeenCalled();
  });

  it('rejects a malformed body with 400 before verifying', async () => {
    const res = await POST(post('{not json'));
    expect(res.status).toBe(400);
    expect(verifySnsSignature).not.toHaveBeenCalled();
  });

  it('completes the subscription handshake', async () => {
    const res = await POST(
      post({
        Type: 'SubscriptionConfirmation',
        TopicArn: TOPIC,
        SubscribeURL: 'https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription',
      }),
    );
    expect(res.status).toBe(200);
    expect(confirmSnsSubscription).toHaveBeenCalledWith(
      'https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription',
    );
  });

  it('advances the delivery row by wamid and marks the number reachable', async () => {
    const res = await POST(
      post(
        notification({
          changes: [
            {
              value: {
                statuses: [
                  { id: 'wamid.A', status: 'delivered', recipient_id: '919876543210' },
                ],
              },
            },
          ],
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect(systemUpdateDeliveryByProviderId).toHaveBeenCalledWith('wamid.A', {
      status: 'delivered',
      errorCode: null,
    });
    // Meta reports bare digits; profiles are keyed by E.164.
    expect(systemMarkWhatsAppStatus).toHaveBeenCalledWith('+919876543210', 'verified');
  });

  it('marks a number failed and carries the Meta error code', async () => {
    await POST(
      post(
        notification({
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.B',
                    status: 'failed',
                    recipient_id: '919876543210',
                    errors: [{ code: 131026 }],
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    expect(systemUpdateDeliveryByProviderId).toHaveBeenCalledWith('wamid.B', {
      status: 'failed',
      errorCode: '131026',
    });
    expect(systemMarkWhatsAppStatus).toHaveBeenCalledWith('+919876543210', 'failed');
  });

  it('records an opt-out and ignores every other inbound message', async () => {
    await POST(
      post(
        notification({
          changes: [
            {
              value: {
                messages: [
                  { from: '919876543210', text: { body: 'STOP' } },
                  { from: '919876543211', text: { body: 'thanks!' } },
                ],
              },
            },
          ],
        }),
      ),
    );
    expect(systemRecordWhatsAppOptOut).toHaveBeenCalledTimes(1);
    expect(systemRecordWhatsAppOptOut).toHaveBeenCalledWith('+919876543210');
  });

  it('refuses a valid signature from a topic that is not ours', async () => {
    process.env.AWS_EUM_SNS_TOPIC_ARN = TOPIC;
    const res = await POST(
      post({
        ...notification({ changes: [] }),
        TopicArn: 'arn:aws:sns:ap-south-1:999999999999:someone-else',
      }),
    );
    expect(res.status).toBe(403);
    expect(systemUpdateDeliveryByProviderId).not.toHaveBeenCalled();
  });

  it('acknowledges an unrecognised event rather than making SNS retry', async () => {
    const res = await POST(post({ Type: 'UnsubscribeConfirmation', TopicArn: TOPIC }));
    expect(res.status).toBe(200);
    expect(systemUpdateDeliveryByProviderId).not.toHaveBeenCalled();
  });
});
