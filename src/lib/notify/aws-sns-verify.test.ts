import { describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, createSign } from 'node:crypto';
import {
  canonicalSnsString,
  isSnsUrl,
  verifySnsSignature,
  type SnsMessage,
} from '@/lib/notify/aws-sns-verify';

/**
 * A real RSA keypair signs a real canonical string here, so these tests prove
 * the verifier actually verifies — a stub that always returned true would pass
 * a shape test but fail this one.
 */

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CERT_URL = 'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-abc.pem';
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const fetchCertificate = async () => publicPem;

function sign(message: SnsMessage, algorithm = 'RSA-SHA1'): string {
  const canonical = canonicalSnsString(message);
  const signer = createSign(algorithm);
  signer.update(canonical!, 'utf8');
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function notification(patch: Partial<SnsMessage> = {}): SnsMessage {
  const base: SnsMessage = {
    Type: 'Notification',
    MessageId: 'm-1',
    TopicArn: 'arn:aws:sns:ap-south-1:123456789012:vcfo-eum',
    Message: '{"whatsAppWebhookEntry":"{}"}',
    Timestamp: '2026-09-08T10:00:00.000Z',
    SignatureVersion: '1',
    SigningCertURL: CERT_URL,
    ...patch,
  };
  return { ...base, Signature: sign(base) };
}

describe('isSnsUrl', () => {
  it('accepts only HTTPS on an AWS SNS host', () => {
    expect(isSnsUrl(CERT_URL)).toBe(true);
    expect(isSnsUrl('https://sns.cn-north-1.amazonaws.com.cn/x.pem')).toBe(true);
    // The certificate host is the load-bearing check: anyone who can choose it
    // can sign anything they like.
    expect(isSnsUrl('https://evil.example.com/x.pem')).toBe(false);
    expect(isSnsUrl('https://sns.ap-south-1.amazonaws.com.evil.com/x.pem')).toBe(false);
    expect(isSnsUrl('http://sns.ap-south-1.amazonaws.com/x.pem')).toBe(false);
    expect(isSnsUrl('not a url')).toBe(false);
    expect(isSnsUrl(undefined)).toBe(false);
  });
});

describe('canonicalSnsString', () => {
  it('includes Subject only when it is present', () => {
    const withSubject = canonicalSnsString({
      Type: 'Notification',
      MessageId: 'm-1',
      Subject: 's',
      Message: 'body',
      Timestamp: 't',
      TopicArn: 'arn',
    });
    expect(withSubject).toBe('Message\nbody\nMessageId\nm-1\nSubject\ns\nTimestamp\nt\nTopicArn\narn\nType\nNotification\n');

    expect(
      canonicalSnsString({
        Type: 'Notification',
        MessageId: 'm-1',
        Message: 'body',
        Timestamp: 't',
        TopicArn: 'arn',
      }),
    ).toBe('Message\nbody\nMessageId\nm-1\nTimestamp\nt\nTopicArn\narn\nType\nNotification\n');
  });

  it('refuses an unknown type or a missing required field', () => {
    expect(canonicalSnsString({ Type: 'Nonsense' })).toBeNull();
    expect(canonicalSnsString({ Type: 'Notification', MessageId: 'm-1' })).toBeNull();
  });
});

describe('verifySnsSignature', () => {
  it('accepts a correctly signed notification', async () => {
    expect(await verifySnsSignature(notification(), { fetchCertificate })).toBe(true);
  });

  it('accepts SignatureVersion 2 signed with SHA256', async () => {
    const base: SnsMessage = {
      Type: 'Notification',
      MessageId: 'm-2',
      TopicArn: 'arn',
      Message: 'body',
      Timestamp: 't',
      SignatureVersion: '2',
      SigningCertURL: CERT_URL,
    };
    const message = { ...base, Signature: sign(base, 'RSA-SHA256') };
    expect(await verifySnsSignature(message, { fetchCertificate })).toBe(true);
  });

  it('rejects a message whose body was altered after signing', async () => {
    const forged = { ...notification(), Message: '{"whatsAppWebhookEntry":"tampered"}' };
    expect(await verifySnsSignature(forged, { fetchCertificate })).toBe(false);
  });

  it('rejects a certificate hosted anywhere but AWS', async () => {
    const message = notification({ SigningCertURL: 'https://evil.example.com/x.pem' });
    expect(
      await verifySnsSignature(message, {
        fetchCertificate: async () => publicPem,
      }),
    ).toBe(false);
  });

  it('rejects a missing signature, an unknown version, and an unfetchable cert', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const valid = notification();
    expect(await verifySnsSignature({ ...valid, Signature: '' }, { fetchCertificate })).toBe(
      false,
    );
    expect(
      await verifySnsSignature({ ...valid, SignatureVersion: '9' }, { fetchCertificate }),
    ).toBe(false);
    expect(
      await verifySnsSignature(valid, { fetchCertificate: async () => null }),
    ).toBe(false);
  });

  it('rejects a signature signed by a different key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const base = notification();
    const canonical = canonicalSnsString(base)!;
    const signer = createSign('RSA-SHA1');
    signer.update(canonical, 'utf8');
    signer.end();
    const message = { ...base, Signature: signer.sign(other.privateKey, 'base64') };
    expect(await verifySnsSignature(message, { fetchCertificate })).toBe(false);
  });
});
