import 'server-only';

import { SIGNATURE_HEADER, signBody, signViewerToken, TOKEN_TTL_SECONDS, type ViewerRole } from './contract';

/**
 * Suite's side of the broker connection. The env is read on each call (dev/prod parity):
 *   LIVE_BROWSER_URL            the broker's internal URL (Suite → broker, signed POSTs)
 *   LIVE_BROWSER_PUBLIC_URL     the broker's public base for the viewer's WebSocket, for example wss://live.sbctrack.in
 *   LIVE_BROWSER_SHARED_SECRET  the HMAC key both sides hold
 *   LIVE_BROWSER_MOCK_ORIGIN    where the broker's Chromium finds the mock portal (default http://127.0.0.1:4318)
 * `browserConfigured()` in `src/lib/card-agents/config.ts` says whether the first three are set.
 */

type Env = Record<string, string | undefined>;

const trimSlash = (s: string) => s.replace(/\/+$/, '');

export function liveBrowserEnv(env: Env = process.env) {
  return {
    url: trimSlash(env.LIVE_BROWSER_URL?.trim() ?? ''),
    publicUrl: trimSlash(env.LIVE_BROWSER_PUBLIC_URL?.trim() ?? ''),
    secret: env.LIVE_BROWSER_SHARED_SECRET?.trim() ?? '',
    mockOrigin: trimSlash(env.LIVE_BROWSER_MOCK_ORIGIN?.trim() || 'http://127.0.0.1:4318'),
  };
}

export class BrokerUnavailable extends Error {}

/** One signed POST to the broker. Network failures throw `BrokerUnavailable`. */
export async function brokerPost(path: string, body: unknown, env: Env = process.env): Promise<{ status: number; json: Record<string, unknown> }> {
  const { url, secret } = liveBrowserEnv(env);
  if (!url || !secret) throw new BrokerUnavailable('live browser not configured');
  const raw = JSON.stringify(body);
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signBody(secret, raw) },
      body: raw,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new BrokerUnavailable((error as Error).message);
  }
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

/** A viewer token and the stream address for it (the token only opens the socket). */
export function viewerAccess(sessionId: string, userId: string, role: ViewerRole, env: Env = process.env) {
  const { publicUrl, secret } = liveBrowserEnv(env);
  const token = signViewerToken(secret, { sid: sessionId, uid: userId, role });
  const wsBase = publicUrl.replace(/^http/, 'ws');
  const httpBase = publicUrl.replace(/^ws/, 'http');
  return {
    token,
    role,
    streamUrl: `${wsBase}/sessions/${sessionId}/stream?token=${encodeURIComponent(token)}`,
    pdfUrl: role === 'act' ? `${httpBase}/sessions/${sessionId}/pdf?token=${encodeURIComponent(token)}` : null,
    signedPdfUrl: role === 'act' ? `${httpBase}/sessions/${sessionId}/signed-pdf?token=${encodeURIComponent(token)}` : null,
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
  };
}
