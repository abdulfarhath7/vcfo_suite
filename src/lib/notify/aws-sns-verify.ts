import 'server-only';

import { createPublicKey, createVerify, X509Certificate } from 'node:crypto';

/**
 * Amazon SNS message verification.
 *
 * This endpoint is unauthenticated by construction — SNS posts to a public
 * URL — so the signature IS the authentication. Everything below exists
 * because an unverified handler lets anyone mark a delivery `failed`, or
 * worse, opt a client out of notifications by POSTing a forged inbound
 * message.
 *
 * This is NOT a hand-rolled HMAC. It is the algorithm AWS publishes:
 *   1. rebuild the canonical string from the exact fields, in the exact
 *      order, that SNS signed for this message Type;
 *   2. fetch the signing certificate, refusing any URL that is not an
 *      `sns.<region>.amazonaws.com` HTTPS host (an attacker who can choose
 *      the certificate can sign anything, so the host check is the load-bearing
 *      part);
 *   3. verify the RSA signature with SHA1 (SignatureVersion 1) or SHA256
 *      (SignatureVersion 2).
 *
 * Every failure path returns false. Nothing here throws, so a malformed or
 * hostile payload can only ever be rejected.
 */

export type SnsMessage = {
  Type?: string;
  MessageId?: string;
  TopicArn?: string;
  Subject?: string;
  Message?: string;
  Timestamp?: string;
  Token?: string;
  SubscribeURL?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  /** Older SNS payloads spell it this way. */
  SigningCertUrl?: string;
};

/** `sns.ap-south-1.amazonaws.com`, `sns.cn-north-1.amazonaws.com.cn`. */
const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

/**
 * Signed field order per message type. AWS specifies these exactly; a
 * different order or a missing optional field produces a different canonical
 * string and the signature will not match.
 */
const SIGNED_FIELDS: Record<string, readonly (keyof SnsMessage)[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
  UnsubscribeConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
};

/** True for an HTTPS URL on an AWS-owned SNS host. */
export function isSnsUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && SNS_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * The exact bytes SNS signed. `Subject` is included only when present, which
 * is why it cannot simply be defaulted to an empty string.
 */
export function canonicalSnsString(message: SnsMessage): string | null {
  const fields = SIGNED_FIELDS[message.Type?.trim() ?? ''];
  if (!fields) return null;

  let out = '';
  for (const field of fields) {
    const value = message[field];
    if (value === undefined || value === null) {
      // Subject is genuinely optional; every other field is required.
      if (field === 'Subject') continue;
      return null;
    }
    out += `${field}\n${String(value)}\n`;
  }
  return out;
}

const certificateCache = new Map<string, string>();

async function defaultFetchCertificate(url: string): Promise<string | null> {
  const cached = certificateCache.get(url);
  if (cached) return cached;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const pem = await res.text();
    certificateCache.set(url, pem);
    return pem;
  } catch (err) {
    console.error('[aws-sns] certificate fetch failed', err);
    return null;
  }
}

/** Accepts an X.509 certificate (what AWS serves) or a bare public key. */
function publicKeyFromPem(pem: string) {
  return pem.includes('BEGIN CERTIFICATE')
    ? new X509Certificate(pem).publicKey
    : createPublicKey(pem);
}

export type VerifySnsDeps = {
  /** Injected in tests so verification runs without the network. */
  fetchCertificate?: (url: string) => Promise<string | null>;
};

/**
 * Verify one SNS envelope. Returns false — never throws — for a bad
 * signature, an unknown type, a non-AWS certificate host, or a malformed
 * payload.
 */
export async function verifySnsSignature(
  message: SnsMessage,
  deps: VerifySnsDeps = {},
): Promise<boolean> {
  const signature = message.Signature?.trim();
  const certUrl = (message.SigningCertURL ?? message.SigningCertUrl)?.trim();
  const version = (message.SignatureVersion ?? '1').trim();

  if (!signature || !isSnsUrl(certUrl)) return false;
  if (version !== '1' && version !== '2') return false;

  const canonical = canonicalSnsString(message);
  if (!canonical) return false;

  const pem = await (deps.fetchCertificate ?? defaultFetchCertificate)(certUrl!);
  if (!pem) return false;

  try {
    const verifier = createVerify(version === '2' ? 'RSA-SHA256' : 'RSA-SHA1');
    verifier.update(canonical, 'utf8');
    verifier.end();
    return verifier.verify(publicKeyFromPem(pem), signature, 'base64');
  } catch (err) {
    console.error('[aws-sns] signature verification failed', err);
    return false;
  }
}

/**
 * Complete the subscription handshake by GETting the SubscribeURL.
 *
 * The URL is re-checked against the SNS host allowlist before it is fetched:
 * the signature proves the envelope came from SNS, but fetching an arbitrary
 * URL from a signed field would still be an SSRF primitive if that check were
 * skipped.
 */
export async function confirmSnsSubscription(
  subscribeUrl: string | undefined,
): Promise<boolean> {
  if (!isSnsUrl(subscribeUrl)) return false;
  try {
    const res = await fetch(subscribeUrl!.trim());
    return res.ok;
  } catch (err) {
    console.error('[aws-sns] subscription confirmation failed', err);
    return false;
  }
}
