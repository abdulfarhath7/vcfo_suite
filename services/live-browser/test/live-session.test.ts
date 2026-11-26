/**
 * The live browser end to end at the service level: the extension's mock portal, a fake Suite that
 * checks every callback's signature, the broker's HTTP and WebSocket edge, a real Chromium.
 *
 * It proves: frames reach a watch viewer and its input is dropped; the person types the login
 * through an act viewer; the agent never writes a login, password, captcha or OTP field; the page
 * fills without a further click because the plan matches the approval (G13); Submit waits for the
 * certifier's checks (G17); Submit and Pay are never clicked by the agent; the SRN read after the
 * person clicks them is written back; the session ends and its profile folder is deleted.
 */
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { SIGNATURE_HEADER, signBody, signViewerToken, verifyBody, type CallbackOp, type SessionStartBody, type StreamServerMessage } from '../../../src/lib/live-browser/contract';
import { agentScript } from '../src/agent-script';
import { Broker } from '../src/broker';
import { readConfig } from '../src/config';
import { createBrokerServer } from '../src/server';
import { PROFILE } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const SECRET = 'test-secret-that-is-long-enough-0123456789';
const SID = '0a6c3a52-1f7e-4d55-9a07-1b2c3d4e5f60';
const MOCK_PORT = 4328;
const signed = JSON.parse(readFileSync(path.join(here, '../../../extensions/vcfo-assist/src/recipes/bundled.json'), 'utf8')).recipes['spice-a'];

interface FakeSuite {
  server: Server;
  url: string;
  ops: CallbackOp[];
  attested: boolean;
  badSignatures: number;
}

async function fakeSuite(): Promise<FakeSuite> {
  const state: FakeSuite = { server: null as unknown as Server, url: '', ops: [], attested: false, badSignatures: 0 };
  state.server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!verifyBody(SECRET, req.headers[SIGNATURE_HEADER] as string, raw)) {
        state.badSignatures += 1;
        res.writeHead(401).end('{}');
        return;
      }
      const op = JSON.parse(raw) as CallbackOp;
      state.ops.push(op);
      const reply = (body: unknown) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
      if (op.op === 'createRun') return reply({ ok: true, run: { id: '7d0b9f8e-0000-4000-8000-000000000001' } });
      if (op.op === 'attestation') return reply({ ok: true, run: { attestation: state.attested ? { id: 'att-1', certifierName: 'Divya', createdAt: new Date().toISOString() } : null } });
      return reply({ ok: true, run: {} });
    });
  });
  await new Promise<void>((r) => state.server.listen(0, '127.0.0.1', r));
  state.url = `http://127.0.0.1:${(state.server.address() as AddressInfo).port}`;
  return state;
}

function viewer(base: string, role: 'watch' | 'act', origin: string) {
  const token = signViewerToken(SECRET, { sid: SID, uid: role === 'act' ? 'lead-1' : 'manager-1', role });
  const ws = new WebSocket(`${base.replace('http', 'ws')}/sessions/${SID}/stream?token=${token}`, { headers: { origin } });
  const messages: StreamServerMessage[] = [];
  ws.on('message', (d: Buffer | string) => messages.push(JSON.parse(d.toString()) as StreamServerMessage));
  const opened = new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  const send = (m: unknown) => ws.send(JSON.stringify(m));
  const key = (key: string, code: string, keyCode: number, text?: string) => {
    send({ t: 'key', type: 'keyDown', key, code, keyCode, ...(text ? { text } : {}) });
    send({ t: 'key', type: 'keyUp', key, code, keyCode });
  };
  const type = (s: string) => {
    for (const c of s) key(c, `Key${c.toUpperCase()}`, c.toUpperCase().charCodeAt(0), c);
  };
  return { ws, messages, opened, send, key, type, tab: () => key('Tab', 'Tab', 9) };
}

async function until<T>(what: string, fn: () => T | Promise<T>, ms = 30_000): Promise<NonNullable<T>> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as NonNullable<T>;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe('live browser session on the mock portal', () => {
  let suite: FakeSuite;
  let mock: Server;
  let broker: Broker;
  let server: Server;
  let base = '';
  const post = async (p: string, body: unknown) => {
    const raw = JSON.stringify(body);
    const res = await fetch(`${base}${p}`, { method: 'POST', headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signBody(SECRET, raw) }, body: raw });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };
  const mockState = async () => (await post(`/sessions/${SID}/test`, { sessionId: SID, what: 'mock' })).json.result as {
    clicks: Record<string, number>;
    values: Record<string, string>;
    login: string[];
    loggedIn: boolean;
    marks: string;
  };
  const events = () => suite.ops.filter((o): o is Extract<CallbackOp, { op: 'event' }> => o.op === 'event').map((o) => o.event);
  const updates = () => suite.ops.filter((o): o is Extract<CallbackOp, { op: 'updateRun' }> => o.op === 'updateRun').map((o) => o.body);

  beforeAll(async () => {
    suite = await fakeSuite();
    const serve = (await import(pathToFileURL(path.join(here, '../../../extensions/vcfo-assist/mock-portal/serve.mjs')).href)) as { startMockPortal(port: number): Promise<Server> };
    mock = await serve.startMockPortal(MOCK_PORT);
    const cfg = { ...readConfig({ LIVE_BROWSER_SHARED_SECRET: SECRET, SUITE_URL: suite.url, LIVE_BROWSER_WARM: '0', LIVE_BROWSER_TYPE_MS: '5', LIVE_BROWSER_FIELD_MAX_MS: '200', LIVE_BROWSER_TEST_HOOKS: '1', LIVE_BROWSER_CHROMIUM_PATH: process.env.LIVE_BROWSER_CHROMIUM_PATH }) };
    broker = new Broker(cfg, await agentScript());
    server = createBrokerServer(cfg, broker);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await broker?.close();
    server?.close();
    mock?.close();
    suite?.server.close();
  });

  it('refuses an unsigned start and a forged viewer token', async () => {
    const res = await fetch(`${base}/sessions`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
    const forged = new WebSocket(`${base.replace('http', 'ws')}/sessions/${SID}/stream?token=abc.def`);
    const code = await new Promise<string>((resolve) => forged.on('error', (e: Error) => resolve(e.message)));
    expect(code).toMatch(/401/);
  });

  it('fills Part A while the person logs in, submits and pays', async () => {
    const start: SessionStartBody = {
      sessionId: SID,
      demo: false,
      userId: 'lead-1',
      engagementId: 'eng-1',
      engagementName: 'Orbit Labs',
      agentId: 'incorporation',
      taskId: 'spice-a',
      recipeId: 'spice-a',
      startUrl: `http://127.0.0.1:${MOCK_PORT}/spice-a.html`,
      portalLoginLabel: 'lead.mca@firm.test',
      catalog: { ok: true, agents: [], liveEnabled: false, liveHosts: [], extensionDisabled: false, minExtensionVersion: null, firmContacts: { emails: [], phones: [] } },
      signedRecipe: signed,
      profile: { ok: true, schemaVersion: 1, companyName: 'Orbit Labs', profile: PROFILE, missing: [], notes: [] },
      limits: { idleMinutes: 15, maxMinutes: 90 },
    };
    const started = await post('/sessions', start);
    expect(started.json.error ?? null).toBeNull();
    expect(started.status).toBe(201);
    await until('ready event', () => events().some((e) => e.status === 'ready'));

    // A watch viewer sees frames; its keys are dropped.
    const watch = viewer(base, 'watch', suite.url);
    await watch.opened;
    await until('a frame', () => watch.messages.some((m) => m.t === 'frame'));
    expect(watch.messages[0]).toMatchObject({ t: 'hello', role: 'watch' });
    await until('the login gate', () => events().some((e) => e.gate === 'LOGIN'));
    watch.tab();
    watch.type('intruder');
    await new Promise((r) => setTimeout(r, 600));
    expect((await mockState()).login.every((v) => v === '')).toBe(true);

    // The person logs in through the act view (Tab through user id, password, captcha, OTP, Login).
    const act = viewer(base, 'act', suite.url);
    await act.opened;
    expect((await mockState()).login.every((v) => v === '')).toBe(true);
    act.tab();
    act.type('leaduser');
    act.tab();
    act.type('pw');
    act.tab();
    act.type('mock7');
    act.tab();
    act.type('123456');
    act.tab();
    act.key('Enter', 'Enter', 13, '\r');
    await until('logged in on the mock', async () => (await mockState()).loggedIn);

    // G13: the plan matches the approval, so the page fills without a click; G17 holds Submit back.
    await until('the certifier gate', () => events().some((e) => e.gate === 'CERTIFIER'), 45_000);
    const filled = await mockState();
    expect(filled.values['proposedname1']).toBe('Orbit Labs Private Limited');
    expect(filled.values['type-of-company']).toBe('New Company (Others)');
    expect(filled.values['class-of-company']).toBe('Private');
    expect(filled.values['nic-text-box']).toBe('62011');
    expect(filled.values['significance']).toBe('');
    expect(filled.clicks['btn-submit']).toBeUndefined();
    expect(filled.clicks['btn-pay']).toBeUndefined();
    expect(filled.clicks['btn-send-otp']).toBeUndefined();
    expect(filled.marks).not.toContain('human');
    // The login strip is hidden once the person has logged in, so the agent had nothing to refuse
    // there; the login values are the person's own keystrokes, never the agent's.
    expect(filled.login).toEqual(['leaduser', 'pw', 'mock7', '123456']);
    const state = act.messages.filter((m) => m.t === 'state').at(-1);
    expect(state && state.t === 'state' && state.state.fieldsDone).toBeGreaterThanOrEqual(6);

    // The certifier records the checks in Suite; Submit and Pay then pulse, and the person clicks them.
    suite.attested = true;
    await until('the submit gate', () => events().some((e) => e.gate === 'SUBMIT'), 20_000);
    await until('Submit highlighted', async () => (await mockState()).marks.includes('human'));
    for (const css of ['#btn-submit', '#btn-pay']) {
      const at = (await post(`/sessions/${SID}/test`, { sessionId: SID, what: 'rect', css })).json.result as { x: number; y: number };
      act.send({ t: 'mouse', type: 'mouseMoved', x: at.x, y: at.y, button: 'none' });
      act.send({ t: 'mouse', type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
      act.send({ t: 'mouse', type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });
      await new Promise((r) => setTimeout(r, 400));
    }
    await until('the SRN written back', () => updates().some((u) => u.srn === 'AB1234567' && u.status === 'done'), 20_000);
    const after = await mockState();
    expect(after.clicks['btn-submit']).toBe(1);
    expect(after.clicks['btn-pay']).toBe(1);

    // The session ends by itself; the viewers are closed and nothing is kept.
    await until('the end event', () => events().some((e) => e.ended === 'done'), 20_000);
    // The end event is reported before the browser has closed; the pool slot frees right after.
    await until('the session leaves the pool', () => broker.sessions.size === 0);
    expect(suite.badSignatures).toBe(0);
    const createdRun = suite.ops.find((o) => o.op === 'createRun');
    expect(createdRun && createdRun.op === 'createRun' && createdRun.body).toMatchObject({ subAgent: 'spice-a', portalHost: '127.0.0.1', mcaLoginLabel: 'lead.mca@firm.test' });
    // No callback carried a profile value (the rail's confirm table stays on the socket).
    const outbound = JSON.stringify(suite.ops);
    expect(outbound).not.toContain('Orbit Labs Private Limited');
    expect(outbound).not.toContain('leaduser');
  });
});
