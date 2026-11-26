import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The live browser's Suite side: the contract both sides sign with, the start page and host
 * rules, the reaper's reasons, and the edges of the routes (the callback refuses an unsigned
 * body; the token route gives `act` only to the session's owner and refuses a closed session).
 */

const requireAnyRole = vi.fn();
vi.mock('@/auth/guards', () => ({ requireAnyRole: (...a: unknown[]) => requireAnyRole(...a) }));
const getLiveSession = vi.fn();
const assertSessionOwner = vi.fn();
vi.mock('@/db/repositories/live-browser-sessions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/db/repositories/live-browser-sessions');
  return { ...actual, getLiveSession: (...a: unknown[]) => getLiveSession(...a), assertSessionOwner: (...a: unknown[]) => assertSessionOwner(...a) };
});
const handleLiveBrowserCallback = vi.fn();
vi.mock('@/lib/live-browser/callback', () => ({ handleLiveBrowserCallback: (...a: unknown[]) => handleLiveBrowserCallback(...a) }));
vi.mock('@/db/demo-scope', () => ({ runInScope: (_demo: boolean, fn: () => unknown) => fn() }));

const { signBody, signViewerToken, verifyBody, verifyViewerToken, SIGNATURE_HEADER } = await import('./contract');
const { startUrlFor } = await import('./start');
const { reapReason } = await import('@/jobs/live-browser-reaper');
const { LiveBrowserAccessError, endStatusFor } = await import('@/db/repositories/live-browser-sessions');
const { POST: callback } = await import('../../../app/api/live-browser/callback/route');
const { GET: token } = await import('../../../app/api/live-browser/sessions/[id]/token/route');
const { getRecipe, getPack } = await import('@/lib/assist-agents/registry');

const SECRET = 'suite-test-secret-0123456789abcdef0123456789';
const SID = '0a6c3a52-1f7e-4d55-9a07-1b2c3d4e5f60';
const lead = { userId: 'u-lead', email: 'lead@vcfo.local', name: 'Lead', role: 'intern' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LIVE_BROWSER_SHARED_SECRET', SECRET);
  vi.stubEnv('LIVE_BROWSER_PUBLIC_URL', 'wss://live.example.test');
  vi.stubEnv('LIVE_BROWSER_URL', 'https://live.example.test');
  vi.stubEnv('LIVE_BROWSER_MOCK_ORIGIN', 'http://127.0.0.1:4318');
  vi.stubEnv('ASSIST_LIVE_PACKS', '');
  requireAnyRole.mockResolvedValue({ ok: true, ctx: lead });
});

describe('contract', () => {
  it('round-trips a body signature and a viewer token, and refuses tampering', () => {
    const body = JSON.stringify({ op: 'event', sessionId: SID });
    expect(verifyBody(SECRET, signBody(SECRET, body), body)).toBe(true);
    expect(verifyBody(SECRET, signBody(SECRET, body), `${body} `)).toBe(false);
    const t = signViewerToken(SECRET, { sid: SID, uid: 'u', role: 'act' });
    expect(verifyViewerToken(SECRET, t, SID)?.role).toBe('act');
    expect(verifyViewerToken('x'.repeat(40), t, SID)).toBeNull();
  });
});

describe('start page (G11)', () => {
  const recipe = getRecipe('spice-a')!;
  const pack = getPack('mca-v3')!;
  it('opens the mock page while the pack is mock-only', () => {
    expect(startUrlFor(recipe, pack, undefined)).toBe('http://127.0.0.1:4318/spice-a.html');
  });
  it('opens the live page only for a cleared, switched-on pack, and the mock on request', () => {
    const cleared = { ...pack, legalStatus: 'cs-cleared' as const };
    const env = { ASSIST_LIVE_PACKS: 'mca-v3', LIVE_BROWSER_MOCK_ORIGIN: 'http://127.0.0.1:4318' };
    expect(startUrlFor(recipe, cleared, undefined, env)).toMatch(/^https:\/\/www\.mca\.gov\.in\/content\/mca\//);
    expect(startUrlFor(recipe, cleared, 'mock', env)).toBe('http://127.0.0.1:4318/spice-a.html');
    expect(startUrlFor(recipe, pack, undefined, env)).toBe('http://127.0.0.1:4318/spice-a.html');
  });
});

describe('reaper', () => {
  const now = new Date('2026-11-26T10:00:00Z');
  const settings = { killSwitch: false, idleMinutes: 15, maxMinutes: 90 };
  const ago = (m: number) => new Date(now.getTime() - m * 60_000);
  it('ends idle, over-time, killed, never-started and unconfigured sessions, and keeps a live one', () => {
    expect(reapReason({ status: 'running', createdAt: ago(10), lastActivityAt: ago(1) }, settings, true, now)).toBeNull();
    expect(reapReason({ status: 'running', createdAt: ago(30), lastActivityAt: ago(20) }, settings, true, now)).toBe('idle');
    expect(reapReason({ status: 'running', createdAt: ago(95), lastActivityAt: ago(1) }, settings, true, now)).toBe('max_time');
    expect(reapReason({ status: 'starting', createdAt: ago(6), lastActivityAt: ago(6) }, settings, true, now)).toBe('error');
    expect(reapReason({ status: 'running', createdAt: ago(1), lastActivityAt: ago(1) }, { ...settings, killSwitch: true }, true, now)).toBe('kill_switch');
    expect(reapReason({ status: 'running', createdAt: ago(1), lastActivityAt: ago(1) }, settings, false, now)).toBe('error');
    expect(endStatusFor('idle')).toBe('expired');
  });
});

describe('POST /api/live-browser/callback', () => {
  const req = (body: string, sig: string | null) =>
    new Request('https://app.test/api/live-browser/callback', { method: 'POST', body, headers: { 'content-type': 'application/json', ...(sig ? { [SIGNATURE_HEADER]: sig } : {}) } });
  it('refuses an unsigned or wrongly signed body before reading it', async () => {
    const body = JSON.stringify({ op: 'event', sessionId: SID, demo: false, event: {} });
    expect((await callback(req(body, null))).status).toBe(401);
    expect((await callback(req(body, signBody('y'.repeat(40), body)))).status).toBe(401);
    expect(handleLiveBrowserCallback).not.toHaveBeenCalled();
  });
  it('refuses an unknown op and answers a signed one through the handler', async () => {
    const bad = JSON.stringify({ op: 'eval', sessionId: SID, demo: false });
    expect((await callback(req(bad, signBody(SECRET, bad)))).status).toBe(400);
    handleLiveBrowserCallback.mockResolvedValue({ status: 200, body: { ok: true } });
    const good = JSON.stringify({ op: 'event', sessionId: SID, demo: false, event: { status: 'running' } });
    expect((await callback(req(good, signBody(SECRET, good)))).status).toBe(200);
    expect(handleLiveBrowserCallback).toHaveBeenCalledWith(expect.objectContaining({ op: 'event', sessionId: SID }));
  });
});

describe('GET /api/live-browser/sessions/[id]/token', () => {
  const get = (role: string) => token(new Request(`https://app.test/x?role=${role}`), { params: Promise.resolve({ id: SID }) });
  const open = { id: SID, open: true };
  it('is staff only', async () => {
    requireAnyRole.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    expect((await get('watch')).status).toBe(403);
    expect(requireAnyRole).toHaveBeenCalledWith('admin', 'manager', 'intern');
  });
  it('gives a watch token to staff in scope and an act token only through the owner check', async () => {
    getLiveSession.mockResolvedValue(open);
    const w = (await (await get('watch')).json()) as { token: string; streamUrl: string; role: string };
    expect(w.role).toBe('watch');
    expect(w.streamUrl).toBe(`wss://live.example.test/sessions/${SID}/stream?token=${encodeURIComponent(w.token)}`);
    expect(verifyViewerToken(SECRET, w.token, SID)).toMatchObject({ uid: 'u-lead', role: 'watch' });
    expect(assertSessionOwner).not.toHaveBeenCalled();

    assertSessionOwner.mockRejectedValue(new LiveBrowserAccessError('forbidden', 403));
    expect((await get('act')).status).toBe(403);
    assertSessionOwner.mockResolvedValue(open);
    expect(verifyViewerToken(SECRET, ((await (await get('act')).json()) as { token: string }).token, SID)?.role).toBe('act');
  });
  it('refuses a closed session and one out of scope', async () => {
    getLiveSession.mockResolvedValue({ id: SID, open: false });
    expect((await get('watch')).status).toBe(410);
    getLiveSession.mockResolvedValue(null);
    expect((await get('watch')).status).toBe(404);
  });
});
