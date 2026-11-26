/**
 * The broker's HTTP and WebSocket edge.
 *
 * Suite → broker (HMAC-signed JSON bodies, `contract.ts`):
 *   POST /sessions               start a session (SessionStartBody)
 *   POST /sessions/:id/status    the session's status, viewers and last activity
 *   POST /sessions/:id/stop      end it (`{ sessionId, reason }`)
 *   POST /warm                   keep a browser warm for a fast start
 * Viewer → broker (a viewer token Suite signed for one session and one user):
 *   WS   /sessions/:id/stream?token=…   frames out; act input and control in
 *   GET  /sessions/:id/pdf?token=…      the portal's PDF to sign, once (act only)
 *   POST /sessions/:id/signed-pdf?token=…  the signed PDF dropped in the rail (act only)
 * Health: GET /healthz. Test hooks (LIVE_BROWSER_TEST_HOOKS=1, signed): POST /sessions/:id/test.
 *
 * No route logs a request body, a frame or an input message.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { WebSocketServer } from 'ws';
import { SIGNATURE_HEADER, verifyBody, verifyViewerToken, type SessionStartBody, type LiveSessionEndReason } from '../../../src/lib/live-browser/contract';
import { Broker, PoolFull } from './broker';
import type { BrokerConfig } from './config';

const MAX_BODY = 8 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const END_REASONS = new Set<LiveSessionEndReason>(['done', 'cancelled', 'idle', 'max_time', 'kill_switch', 'error']);

function readBody(req: IncomingMessage, limit = MAX_BODY): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** The viewer's address: the right-most X-Forwarded-For entry is the one the ALB itself appended. */
export function viewerIp(req: IncomingMessage): string | null {
  const xff = req.headers['x-forwarded-for'];
  const chain = (Array.isArray(xff) ? xff.join(',') : (xff ?? '')).split(',').map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - 1] ?? req.socket.remoteAddress ?? null;
}

export function createBrokerServer(cfg: BrokerConfig, broker: Broker): Server {
  const suiteOrigin = (() => {
    try {
      return new URL(cfg.suiteUrl).origin;
    } catch {
      return '';
    }
  })();

  const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };
  const cors = (req: IncomingMessage): Record<string, string> =>
    req.headers.origin === suiteOrigin ? { 'access-control-allow-origin': suiteOrigin, vary: 'Origin', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST' } : {};

  async function signed<T>(req: IncomingMessage, res: ServerResponse): Promise<T | null> {
    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      send(res, 413, { ok: false, error: 'too_large' });
      return null;
    }
    const header = req.headers[SIGNATURE_HEADER];
    if (!verifyBody(cfg.secret, Array.isArray(header) ? header[0] : header, raw)) {
      send(res, 401, { ok: false, error: 'bad_signature' });
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      send(res, 400, { ok: false, error: 'invalid_json' });
      return null;
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://broker');
    const parts = url.pathname.split('/').filter(Boolean);
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors(req));
        res.end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/healthz') {
        send(res, 200, { ok: true, node: cfg.node, sessions: broker.sessions.size, poolMax: cfg.poolMax });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/warm') {
        if (!(await signed(req, res))) return;
        void broker.ensureWarm().catch(() => undefined);
        send(res, 202, { ok: true });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/sessions') {
        const body = await signed<SessionStartBody>(req, res);
        if (!body) return;
        if (!UUID.test(body.sessionId ?? '') || !/^https?:\/\//.test(body.startUrl ?? '') || !body.signedRecipe || !body.userId) {
          send(res, 400, { ok: false, error: 'invalid_session' });
          return;
        }
        try {
          await broker.startSession(body);
          send(res, 201, { ok: true, node: cfg.node, egressIp: cfg.egressIp });
        } catch (err) {
          if (err instanceof PoolFull) send(res, 503, { ok: false, error: 'pool_full' });
          else send(res, 500, { ok: false, error: `start_failed: ${(err as Error).message}`.slice(0, 300) });
        }
        return;
      }
      if (parts[0] === 'sessions' && parts[1] && UUID.test(parts[1])) {
        const id = parts[1];
        const session = broker.sessions.get(id);
        const action = parts[2];
        if (req.method === 'POST' && (action === 'status' || action === 'stop' || action === 'test')) {
          const body = await signed<{ sessionId?: string; reason?: LiveSessionEndReason; what?: 'mock' | 'rect'; css?: string }>(req, res);
          if (!body) return;
          if (body.sessionId !== id) {
            send(res, 400, { ok: false, error: 'session_mismatch' });
            return;
          }
          if (!session) {
            send(res, 404, { ok: false, error: 'not_found' });
            return;
          }
          if (action === 'status') {
            send(res, 200, { ok: true, status: session.status, viewers: session.viewerCount, lastActivity: new Date(session.lastActivity).toISOString() });
          } else if (action === 'stop') {
            await session.end(body.reason && END_REASONS.has(body.reason) ? body.reason : 'cancelled');
            send(res, 200, { ok: true });
          } else if (cfg.testHooks) {
            send(res, 200, { ok: true, result: await session.testEval(body.what === 'rect' ? 'rect' : 'mock', body.css) });
          } else {
            send(res, 404, { ok: false, error: 'not_found' });
          }
          return;
        }
        if (action === 'pdf' || action === 'signed-pdf') {
          const claims = verifyViewerToken(cfg.secret, url.searchParams.get('token'), id);
          if (!claims || claims.role !== 'act' || !session) {
            send(res, 403, { ok: false, error: 'forbidden' }, cors(req));
            return;
          }
          if (action === 'pdf' && req.method === 'GET') {
            const pdf = session.takePdf();
            if (!pdf) {
              send(res, 404, { ok: false, error: 'no_pdf' }, cors(req));
              return;
            }
            res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${pdf.name.replace(/[^\w.-]/g, '_')}"`, 'cache-control': 'no-store', ...cors(req) });
            res.end(pdf.bytes);
            return;
          }
          if (action === 'signed-pdf' && req.method === 'POST') {
            const raw = await readBody(req, 30 * 1024 * 1024).catch(() => null);
            const body = raw ? (JSON.parse(raw) as { name?: string; base64?: string; signers?: string[] }) : null;
            const ok = body?.name && body.base64 && Array.isArray(body.signers) ? await session.dropSignedPdf({ name: body.name, base64: body.base64, signers: body.signers.map(String) }) : false;
            send(res, ok ? 200 : 409, { ok }, cors(req));
            return;
          }
        }
      }
      send(res, 404, { ok: false, error: 'not_found' });
    } catch (err) {
      send(res, 500, { ok: false, error: `server_error: ${(err as Error).message}`.slice(0, 200) });
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req: IncomingMessage, socket, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://broker');
    const m = /^\/sessions\/([0-9a-f-]{36})\/stream$/i.exec(url.pathname);
    const refuse = (code: number, text: string) => {
      socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (!m) return refuse(404, 'Not Found');
    // A browser always sends Origin; only Suite's own pages may open the stream.
    if (suiteOrigin && req.headers.origin && req.headers.origin !== suiteOrigin) return refuse(403, 'Forbidden');
    const claims = verifyViewerToken(cfg.secret, url.searchParams.get('token'), m[1]!);
    const session = broker.sessions.get(m[1]!);
    if (!claims) return refuse(401, 'Unauthorized');
    if (!session || !session.isOpen) return refuse(410, 'Gone');
    wss.handleUpgrade(req, socket, head, (ws) => {
      const ua = req.headers['user-agent'];
      session.addViewer(ws, claims, viewerIp(req), typeof ua === 'string' ? ua.slice(0, 300) : null);
    });
  });

  server.on('close', () => wss.close());
  return server;
}
