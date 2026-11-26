/**
 * The engine's SuitePort and StorePort in the live browser.
 *
 * The SuitePort is the extension's own `SuiteClient` (same request bodies, same strict keys, same
 * parsing, same `SuiteError`), given a different transport: instead of a fetch inside a Suite tab
 * (`tab-fetch.ts`), each call either is answered from what Suite sent with the session start
 * (catalog, signed recipe, profile) or becomes one HMAC-signed callback to Suite
 * (`POST {SUITE_URL}/api/live-browser/callback`). Suite answers every callback as the person who
 * started the session, for that session's engagement and run only.
 *
 * The StorePort keeps the run in memory only: nothing about the portal session is written to disk
 * (proposed G19).
 */
import { SUITE_PATHS, SuiteClient, type TabFetch, type TabFetchResult } from '../../../extensions/vcfo-assist/src/suite/suite-client';
import type { Persisted, StorePort } from '../../../extensions/vcfo-assist/src/engine/ports';
import { SIGNATURE_HEADER, signBody, type CallbackOp, type SessionStartBody, type ViewerSeen } from '../../../src/lib/live-browser/contract';

export interface CallbackTarget {
  suiteUrl: string;
  secret: string;
}

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type OpBody = DistOmit<CallbackOp, 'sessionId' | 'demo'>;

/** One signed callback to Suite. Network errors read as status 0. */
export async function postCallback(target: CallbackTarget, op: CallbackOp): Promise<TabFetchResult> {
  const body = JSON.stringify(op);
  try {
    const res = await fetch(`${target.suiteUrl}/api/live-browser/callback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signBody(target.secret, body) },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch (err) {
    return { status: 0, json: { error: `suite_unreachable: ${(err as Error).message}` } };
  }
}

const RUNS = /^\/api\/engagements\/[^/]+\/assist-runs$/;
const RUN = /^\/api\/engagements\/[^/]+\/assist-runs\/([^/]+)$/;

/**
 * The transport. `seen()` is the act viewer the broker saw last, for the run's evidence log (G14).
 * The profile is the one Suite sent, with the "I will type it on the portal" fields removed.
 */
export function brokerFetch(start: SessionStartBody, profile: unknown, target: CallbackTarget, seen: () => ViewerSeen | null): TabFetch {
  const base = { sessionId: start.sessionId, demo: start.demo };
  const send = (op: OpBody) => postCallback(target, { ...base, ...op } as CallbackOp);
  return async (path, init) => {
    const method = init.method.toUpperCase();
    const body = (init.body ?? {}) as Record<string, unknown>;
    if (method === 'GET' && path === SUITE_PATHS.catalog()) return { status: 200, json: start.catalog };
    if (method === 'GET' && path === SUITE_PATHS.recipe(start.recipeId)) return { status: 200, json: start.signedRecipe };
    if (method === 'GET' && path.startsWith(SUITE_PATHS.profile(start.engagementId))) return { status: 200, json: profile };
    if (method === 'POST' && RUNS.test(path)) return send({ op: 'createRun', body, seen: seen() });
    const run = RUN.exec(path);
    if (run && method === 'PATCH') return send({ op: 'updateRun', runId: decodeURIComponent(run[1]!), body, seen: seen() });
    if (run && method === 'GET') return send({ op: 'attestation', runId: decodeURIComponent(run[1]!) });
    if (method === 'POST' && path === SUITE_PATHS.resolve()) return send({ op: 'resolve', body });
    if (method === 'POST' && path === SUITE_PATHS.patches()) return send({ op: 'proposePatch', body });
    // Anything else (another engagement's profile, another recipe) is not part of this session.
    return { status: 404, json: { error: 'not_in_session' } };
  };
}

export function serverSuite(start: SessionStartBody, profile: unknown, target: CallbackTarget, seen: () => ViewerSeen | null): SuiteClient {
  return new SuiteClient(brokerFetch(start, profile, target, seen));
}

export class MemoryStore implements StorePort {
  private p: Persisted | null = null;
  async load() {
    return this.p;
  }
  async save(p: Persisted) {
    this.p = p;
  }
  async clear() {
    this.p = null;
  }
}
