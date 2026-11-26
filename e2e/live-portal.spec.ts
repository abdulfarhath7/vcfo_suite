import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { SIGNATURE_HEADER, signBody } from '../src/lib/live-browser/contract';
import { demoEngagementId, login, onLocalDb } from './helpers/login';

/**
 * The live portal browser end to end (docs/specs/live-portal-browser/PLAN.md, CARD-AGENTS.md):
 * a demo lead starts a SPICe+ Part A session for a demo project through the session API (the card
 * panel's "Fill now" calls the same route), watches the frames in the watch view, types the mock
 * login through the act view (the portal tab), and watches the agent fill Part A on the mock
 * portal without a further click (the approval is the start, G13). The agent never clicks Submit
 * or any forbidden button; Submit waits for the certifier's checks (G17); the person clicks Submit
 * and Pay through the act view; the SRN is written back and the session record shows the gates.
 *
 * Needs three processes (see docs/context/notes/live-browser.md):
 *   - the broker:  cd services/live-browser && node build.mjs && LIVE_BROWSER_SHARED_SECRET=… SUITE_URL=http://localhost:3103
 *                  PORT=8091 LIVE_BROWSER_MOCK_PORT=4318 LIVE_BROWSER_TEST_HOOKS=1 node dist/server.mjs
 *   - Suite:       LIVE_BROWSER_URL=http://127.0.0.1:8091 LIVE_BROWSER_PUBLIC_URL=ws://localhost:8091
 *                  LIVE_BROWSER_SHARED_SECRET=… npx next dev -p 3103
 *   - this spec:   LIVE_BROWSER_SHARED_SECRET=… PLAYWRIGHT_BASE_URL=http://localhost:3103 npx playwright test e2e/live-portal.spec.ts
 * It skips itself when the broker is not reachable. It turns the browser route on in
 * `agent_settings` for the run and puts the settings and the project's checklist back afterwards.
 */

test.describe.configure({ mode: 'serial', timeout: 240_000 });

const SLUG = 'demo-kestrel-robotics';
const BROKER = process.env.LIVE_BROWSER_URL ?? 'http://127.0.0.1:8091';
const SECRET = process.env.LIVE_BROWSER_SHARED_SECRET ?? '';
const LOGIN_LABEL = 'lead-divya.mca@demo.test';
const SHOTS = process.env.LIVE_PORTAL_SHOTS ?? path.resolve('test-results/live-portal');

let savedBrowser: unknown = undefined;
let savedChecklist: unknown = null;

async function broker(p: string, body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  const res = await fetch(`${BROKER}${p}`, { method: 'POST', headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signBody(SECRET, raw) }, body: raw });
  return (await res.json()) as { ok: boolean; result?: unknown };
}

interface MockState {
  clicks: Record<string, number>;
  values: Record<string, string>;
  login: string[];
  loggedIn: boolean;
  marks: string;
}

const mockState = async (id: string) => (await broker(`/sessions/${id}/test`, { sessionId: id, what: 'mock' })).result as MockState;

async function session(page: Page, id: string) {
  const res = await page.request.get(`/api/live-browser/sessions/${id}`);
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { session: { status: string; gate: string | null; progressText: string | null; fieldsDone: number; fieldsTotal: number; runId: string | null; viewers: Array<{ userId: string }>; egressIp: string | null; node: string | null; endReason: string | null } }).session;
}

/** Clicks the remote element `css` through the act view's screen (a real mouse event on the stream). */
async function clickRemote(page: Page, id: string, css: string) {
  const at = (await broker(`/sessions/${id}/test`, { sessionId: id, what: 'rect', css })).result as { x: number; y: number };
  const box = await page.getByTestId('live-frame').boundingBox();
  if (!box || !at) throw new Error(`no box for ${css}`);
  await page.mouse.click(box.x + (at.x / 1280) * box.width, box.y + (at.y / 800) * box.height);
}

test.beforeAll(async () => {
  test.skip(!SECRET, 'LIVE_BROWSER_SHARED_SECRET is not set for this run');
  const up = await fetch(`${BROKER}/healthz`).then((r) => r.ok).catch(() => false);
  test.skip(!up, `the live browser broker is not running on ${BROKER}`);
  mkdirSync(SHOTS, { recursive: true });
  await onLocalDb(async (db) => {
    const { rows } = await db.query(`select value from agent_settings where key = 'browser'`);
    savedBrowser = rows[0]?.value;
    await db.query(`insert into agent_settings (key, value) values ('browser', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify({ live: true, pilotUserIds: [] })]);
    // An earlier run's session for the same portal login would refuse this one (one per login, G21).
    await db.query(`update live_browser_sessions set status = 'cancelled', ended_at = now(), end_reason = 'cancelled' where portal_login_label = $1 and ended_at is null`, [LOGIN_LABEL]);
    const c = await db.query('select checklist_state from engagements where slug = $1', [SLUG]);
    savedChecklist = c.rows[0]?.checklist_state ?? null;
  });
});

test.afterAll(async () => {
  await onLocalDb(async (db) => {
    if (savedBrowser === undefined) await db.query(`delete from agent_settings where key = 'browser'`);
    else await db.query(`update agent_settings set value = $1 where key = 'browser'`, [JSON.stringify(savedBrowser)]);
    if (savedChecklist) await db.query('update engagements set checklist_state = $2 where slug = $1', [SLUG, JSON.stringify(savedChecklist)]);
  });
});

test('a client cannot start a session or get a stream token', async ({ page }) => {
  await login(page, 'client');
  const engagementId = await demoEngagementId(SLUG);
  const start = await page.request.post('/api/live-browser/sessions', { data: { engagementId, taskId: 'spice-a', portalLoginLabel: 'x' } });
  expect([401, 403]).toContain(start.status());
  const token = await page.request.get('/api/live-browser/sessions/00000000-0000-4000-8000-000000000000/token?role=watch');
  expect([401, 403]).toContain(token.status());
});

test('a lead fills SPICe+ Part A in the live browser and the person submits', async ({ page, context }) => {
  await login(page, 'lead');
  const engagementId = await demoEngagementId(SLUG);

  // "Fill now": the session API the card's BrowserFillBody calls.
  const started = await page.request.post('/api/live-browser/sessions', { data: { engagementId, taskId: 'spice-a', portalLoginLabel: LOGIN_LABEL } });
  const startBody = (await started.json()) as { session?: { id: string }; error?: string };
  expect(startBody.error ?? null).toBeNull();
  expect(started.status()).toBe(201);
  const id = startBody.session!.id;

  // A second session on the same portal login is refused while this one is open (G21).
  const twice = await page.request.post('/api/live-browser/sessions', { data: { engagementId, taskId: 'spice-a', portalLoginLabel: LOGIN_LABEL } });
  expect(twice.status()).toBe(409);

  // Live mode, watch only: frames arrive, the rail says it is the person's turn to log in.
  await page.goto(`/app/lead/live-portal/${id}?view=watch`);
  // The first visit compiles the page on a dev server, so it gets longer.
  await expect(page.getByTestId('live-portal')).toHaveAttribute('data-role', 'watch', { timeout: 120_000 });
  await expect(page.getByTestId('live-screen-watch')).toBeVisible();
  await expect(page.getByTestId('live-frame')).toHaveAttribute('src', /^data:image\/jpeg;base64,/, { timeout: 30_000 });
  await expect(page.getByTestId('your-turn')).toContainText('Log in', { timeout: 30_000 });
  await page.screenshot({ path: path.join(SHOTS, '1-watch-login.png') });
  expect((await mockState(id)).login.every((v) => v === '')).toBe(true);
  expect((await session(page, id)).gate).toBe('LOGIN');

  // The portal tab (act view): the person types the mock login. The agent never does.
  const portal = await context.newPage();
  await portal.goto(`/app/lead/live-portal/${id}`);
  await expect(portal.getByTestId('live-portal')).toHaveAttribute('data-role', 'act', { timeout: 60_000 });
  await expect(portal.getByTestId('live-frame')).toHaveAttribute('src', /^data:image\/jpeg;base64,/, { timeout: 30_000 });
  const frame = portal.getByTestId('live-frame');
  const box = (await frame.boundingBox())!;
  // Click the mock's banner (not a control), then Tab through user id, password, captcha and OTP.
  await portal.mouse.click(box.x + box.width * 0.5, box.y + 8);
  for (const value of ['divya.mca', 'mock-password', 'M0CK7', '123456']) {
    await portal.keyboard.press('Tab');
    await portal.keyboard.type(value, { delay: 15 });
  }
  await portal.screenshot({ path: path.join(SHOTS, '2-act-login-typed.png') });
  await portal.keyboard.press('Tab');
  await portal.keyboard.press('Enter');
  await expect.poll(async () => (await mockState(id)).loggedIn, { timeout: 20_000 }).toBe(true);

  // The agent fills Part A with no further click (the plan matches the approval) and stops before Submit (G17).
  await expect(page.getByTestId('live-field').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, '3-watch-filling.png') });
  await expect.poll(async () => (await session(page, id)).gate, { timeout: 60_000 }).toBe('CERTIFIER');
  await page.screenshot({ path: path.join(SHOTS, '4-watch-certifier.png') });
  const filled = await mockState(id);
  // What the demo project holds is typed in; what it lacks is left for the person and marked (G16).
  expect(filled.values['proposedname1']?.length).toBeGreaterThan(0);
  expect(filled.values['significance']).toBe('');
  const railFilled = await page.locator('[data-testid="live-field"][data-status="filled"]').count();
  expect(railFilled).toBeGreaterThan(0);
  expect(Object.values(filled.values).filter(Boolean).length).toBeGreaterThanOrEqual(railFilled);
  expect(filled.login).toEqual(['divya.mca', 'mock-password', 'M0CK7', '123456']);
  for (const forbidden of ['btn-submit', 'btn-pay', 'btn-send-otp', 'btn-login']) expect(filled.clicks[forbidden] ?? 0).toBe(forbidden === 'btn-login' ? 1 : 0);
  expect(filled.marks).not.toContain('human');

  const s1 = await session(page, id);
  expect(s1.status).toBe('your_turn');
  expect(s1.fieldsDone).toBeGreaterThan(0);
  expect(s1.runId).toBeTruthy();
  expect(s1.egressIp).toBe('203.0.113.10');
  expect(s1.viewers.length).toBeGreaterThan(0);
  const run = (await (await page.request.get(`/api/engagements/${engagementId}/assist-runs/${s1.runId}`)).json()) as { run: { state: string; status: string; fieldsFilled: number; evidence: { mcaLoginLabel: string | null; device: { userAgent: string } | null; clientIps: Array<{ ip: string }> } } };
  expect(run.run.state).toBe('WAIT_SUBMIT_PAY');
  expect(run.run.fieldsFilled).toBe(s1.fieldsDone);
  // G14 evidence: the portal login label, the live browser as the device, the act viewer's address.
  expect(run.run.evidence.mcaLoginLabel).toBe(LOGIN_LABEL);
  expect(run.run.evidence.device?.userAgent).toContain('VCFO Live Browser');
  expect(run.run.evidence.clientIps.length).toBeGreaterThan(0);

  // The certifier records the checks in Suite; only then do Submit and Pay pulse for the person.
  const att = await page.request.post(`/api/engagements/${engagementId}/assist-runs/${s1.runId}/attestation`, { data: { checks: { fieldsCheckedAgainstRecords: true }, evidenceDocumentIds: [] } });
  expect(att.status()).toBe(201);
  await expect.poll(async () => (await session(page, id)).gate, { timeout: 30_000 }).toBe('SUBMIT');
  await expect.poll(async () => (await mockState(id)).marks, { timeout: 10_000 }).toContain('human');
  expect((await mockState(id)).clicks['btn-submit'] ?? 0).toBe(0);
  await portal.bringToFront();
  await portal.waitForTimeout(800);
  await portal.screenshot({ path: path.join(SHOTS, '5-act-submit-yours.png') });

  // The person clicks Submit and Pay in the portal tab.
  await clickRemote(portal, id, '#btn-submit');
  await portal.waitForTimeout(500);
  await clickRemote(portal, id, '#btn-pay');
  await expect(portal.getByTestId('live-srn')).toContainText('AB1234567', { timeout: 30_000 });
  await portal.screenshot({ path: path.join(SHOTS, '6-act-srn.png') });
  const after = await mockState(id);
  expect(after.clicks['btn-submit']).toBe(1);
  expect(after.clicks['btn-pay']).toBe(1);

  // The run is done with the SRN; the session ends by itself and records why.
  const done = (await (await page.request.get(`/api/engagements/${engagementId}/assist-runs/${s1.runId}`)).json()) as { run: { status: string; srn: string | null } };
  expect(done.run).toMatchObject({ status: 'done', srn: 'AB1234567' });
  await expect.poll(async () => (await session(page, id)).status, { timeout: 30_000 }).toBe('done');
  expect((await session(page, id)).endReason).toBe('done');
});
