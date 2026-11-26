// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import { AGENT_SETTINGS_DEFAULTS, type AgentSettings } from './settings';

/**
 * GET /api/card-agents: staff only; a card read checks the engagement through the scoped
 * repository, and the stepIds read returns the level of every box's robot.
 */

let caller: AuthContext | null = null;
vi.mock('@/auth/guards', () => ({
  requireAnyRole: async (...roles: AppRole[]) => {
    if (!caller) return { ok: false, status: 401, error: 'Unauthorized' };
    if (roles.includes(caller.role) || (caller.role === 'super_admin' && roles.includes('admin'))) return { ok: true, ctx: caller };
    return { ok: false, status: 403, error: 'Forbidden' };
  },
}));
let settings: AgentSettings = AGENT_SETTINGS_DEFAULTS;
const getAgentSettings = vi.fn(async () => settings);
vi.mock('@/db/repositories/agent-settings', () => ({ getAgentSettings: () => getAgentSettings() }));
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({ assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a) }));

const { GET } = await import('../../../app/api/card-agents/route');

const lead: AuthContext = { userId: 'u-lead', email: 'l@x.test', name: 'Lead', role: 'intern', internId: 'i-1' };
const get = (q: string) => GET(new Request(`http://x/api/card-agents?${q}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  settings = AGENT_SETTINGS_DEFAULTS;
  caller = lead;
  assertEngagementAccess.mockResolvedValue({ ok: true, dbId: 'e-1', row: { id: 'e-1', companyName: 'Kestrel Robotics' } });
});

describe('GET /api/card-agents', () => {
  it('refuses a client and a signed-out caller before reading anything', async () => {
    caller = { userId: 'c1', email: 'c@x.test', name: 'Client', role: 'client', clientId: 'cl-1' };
    expect((await get('engagementId=e-1&stepId=reg-4')).status).toBe(403);
    expect((await get('stepIds=reg-4')).status).toBe(403);
    caller = null;
    expect((await get('stepIds=reg-4')).status).toBe(401);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(getAgentSettings).not.toHaveBeenCalled();
  });

  it('returns the levels of every registration box', async () => {
    const res = await get('stepIds=reg-4,reg-1,reg-14');
    expect(res.status).toBe(200);
    const { steps } = await res.json();
    expect(steps['reg-4'].map((a: { name: string; level: string }) => [a.name, a.level])).toEqual([['GST Reg Agent', 'prepare']]);
    expect(steps['reg-1'][0]).toMatchObject({ name: 'PF Agent', level: 'coming', levelLabel: 'Coming' });
    expect(steps['reg-14']).toEqual([]);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect((await get('stepIds=reg-4,DROP TABLE')).status).toBe(400);
  });

  it('reads a card through the scoped engagement check and names the client', async () => {
    const res = await get('engagementId=e-1&stepId=pre-4');
    expect(res.status).toBe(200);
    expect(assertEngagementAccess.mock.calls[0]).toEqual([lead, 'e-1']);
    const body = await res.json();
    expect(body.companyName).toBe('Kestrel Robotics');
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0]).toMatchObject({ taskId: 'spice-a', name: 'Name Reservation Agent', level: 'prepare', dataSource: 'mca-profile', route: 'browser' });
    // Part A's recipe fills only the company section, so its check leaves the directors out.
    expect(body.sections).toEqual({ 'spice-a': ['company'] });
  });

  it('gives a lead 403 on an engagement that is not theirs, and 404 on one that does not exist', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: 'e-2', forbidden: true });
    expect((await get('engagementId=e-2&stepId=reg-4')).status).toBe(403);
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: 'e-3', notFound: true });
    expect((await get('engagementId=e-3&stepId=reg-4')).status).toBe(404);
  });

  it('asks for exactly one of a step or an obligation', async () => {
    expect((await get('engagementId=e-1')).status).toBe(400);
    expect((await get('engagementId=e-1&stepId=reg-4&obligationId=gst-gstr-3b')).status).toBe(400);
    expect((await get('stepId=reg-4')).status).toBe(400);
    const res = await get('engagementId=e-1&obligationId=gst-gstr-3b&instanceId=inst-1');
    expect((await res.json()).agents[0]).toMatchObject({ taskId: 'gstr-3b', route: 'api', level: 'prepare' });
  });

  it('shows practice once the browser route is configured and open, and nothing live under the kill switch', async () => {
    vi.stubEnv('LIVE_BROWSER_URL', 'http://live.internal');
    vi.stubEnv('LIVE_BROWSER_PUBLIC_URL', 'wss://live.test');
    vi.stubEnv('LIVE_BROWSER_SHARED_SECRET', 's');
    settings = { ...AGENT_SETTINGS_DEFAULTS, browser: { live: true, pilotUserIds: [] } };
    expect((await (await get('engagementId=e-1&stepId=pre-4')).json()).agents[0].level).toBe('practice');
    settings = { ...settings, browser: { live: true, pilotUserIds: ['someone-else'] } };
    expect((await (await get('engagementId=e-1&stepId=pre-4')).json()).agents[0].level).toBe('prepare');
    settings = { ...AGENT_SETTINGS_DEFAULTS, killSwitch: true, browser: { live: true, pilotUserIds: [] } };
    expect((await (await get('engagementId=e-1&stepId=pre-4')).json()).agents[0].level).toBe('prepare');
  });
});
