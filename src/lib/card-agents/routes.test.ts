import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The card agent overview and settings routes: staff only (clients 403), results for firm-wide
 * admins only, and PUT /api/agent-settings refused for managers, leads and demo logins.
 */

const requireAnyRole = vi.fn();
const requireAdmin = vi.fn();
vi.mock('@/auth/guards', () => ({
  requireAnyRole: (...a: unknown[]) => requireAnyRole(...a),
  requireAdmin: (...a: unknown[]) => requireAdmin(...a),
}));

const listAgentRunsOverview = vi.fn();
const getAgentsTodaySummary = vi.fn();
const getAgentResults = vi.fn();
const browserHoursThisMonth = vi.fn();
class AgentRunsOverviewForbiddenError extends Error {}
vi.mock('@/db/repositories/agent-runs-overview', () => ({
  AgentRunsOverviewForbiddenError,
  listAgentRunsOverview: (...a: unknown[]) => listAgentRunsOverview(...a),
  getAgentsTodaySummary: (...a: unknown[]) => getAgentsTodaySummary(...a),
  getAgentResults: (...a: unknown[]) => getAgentResults(...a),
  browserHoursThisMonth: (...a: unknown[]) => browserHoursThisMonth(...a),
}));

const getAgentSettings = vi.fn();
const setAgentSetting = vi.fn();
class AgentSettingsForbiddenError extends Error {}
vi.mock('@/db/repositories/agent-settings', () => ({
  AgentSettingsForbiddenError,
  getAgentSettings: (...a: unknown[]) => getAgentSettings(...a),
  setAgentSetting: (...a: unknown[]) => setAgentSetting(...a),
}));
const listPatches = vi.fn();
vi.mock('@/db/repositories/assist-patches', () => ({ listPatches: (...a: unknown[]) => listPatches(...a) }));
const listStaffPeople = vi.fn();
vi.mock('@/db/repositories/profiles', () => ({ listStaffPeople: (...a: unknown[]) => listStaffPeople(...a) }));
vi.mock('@/db/repositories/assist-agent-runs', () => ({ AssistAgentAccessError: class extends Error {} }));
vi.mock('@/lib/assist-agents/resolve', () => ({ AssistResolveRefused: class extends Error {} }));

const runsRoute = await import('../../../app/api/agent-runs/route');
const summaryRoute = await import('../../../app/api/agent-runs/summary/route');
const resultsRoute = await import('../../../app/api/agent-results/route');
const settingsRoute = await import('../../../app/api/agent-settings/route');
const { AGENT_SETTINGS_DEFAULTS } = await import('@/lib/card-agents/settings');

const forbidden = { ok: false, status: 403, error: 'forbidden' };
const as = (role: string, extra: Record<string, unknown> = {}) => ({ ok: true, ctx: { userId: `u-${role}`, email: `${role}@x`, name: role, role, ...extra } });
const put = (body: unknown) => new Request('https://app.test/api/agent-settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  getAgentSettings.mockResolvedValue(AGENT_SETTINGS_DEFAULTS);
  setAgentSetting.mockResolvedValue(AGENT_SETTINGS_DEFAULTS);
  listAgentRunsOverview.mockResolvedValue({ runs: [], agents: [] });
  getAgentsTodaySummary.mockResolvedValue({ yourTurn: 0 });
  getAgentResults.mockResolvedValue({ month: '2026-11' });
  browserHoursThisMonth.mockResolvedValue({ hours: 3, sessions: 2 });
  listPatches.mockResolvedValue([{ id: 'p1' }]);
  listStaffPeople.mockResolvedValue([
    { id: '11111111-1111-1111-1111-111111111111', name: 'Divya', role: 'intern', status: 'active' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Client', role: 'client', status: 'active' },
  ]);
});

describe('GET /api/agent-runs and /summary', () => {
  it('refuses a client with 403 and asks the guard for staff', async () => {
    requireAnyRole.mockResolvedValue(forbidden);
    expect((await runsRoute.GET(new Request('https://app.test/api/agent-runs'))).status).toBe(403);
    expect((await summaryRoute.GET()).status).toBe(403);
    expect(requireAnyRole).toHaveBeenCalledWith('admin', 'manager', 'intern');
    expect(listAgentRunsOverview).not.toHaveBeenCalled();
    expect(getAgentsTodaySummary).not.toHaveBeenCalled();
  });

  it('passes the parsed filters and the session to the repository', async () => {
    requireAnyRole.mockResolvedValue(as('intern'));
    const res = await runsRoute.GET(new Request('https://app.test/api/agent-runs?state=your_turn&period=today&agent=gstr-3b&search=kes'));
    expect(res.status).toBe(200);
    expect(listAgentRunsOverview).toHaveBeenCalledWith(expect.objectContaining({ role: 'intern' }), { state: 'your_turn', period: 'today', agent: 'gstr-3b', search: 'kes' });
  });

  it('maps the repository refusal to 403', async () => {
    requireAnyRole.mockResolvedValue(as('intern'));
    getAgentsTodaySummary.mockRejectedValue(new AgentRunsOverviewForbiddenError());
    expect((await summaryRoute.GET()).status).toBe(403);
  });
});

describe('GET /api/agent-results', () => {
  it('is for firm-wide admins only', async () => {
    requireAdmin.mockResolvedValue(forbidden);
    expect((await resultsRoute.GET(new Request('https://app.test/api/agent-results'))).status).toBe(403);
    expect(getAgentResults).not.toHaveBeenCalled();
  });

  it('refuses a malformed month and passes a good one with the hours cap', async () => {
    requireAdmin.mockResolvedValue(as('admin'));
    expect((await resultsRoute.GET(new Request('https://app.test/api/agent-results?month=2026-13'))).status).toBe(400);
    const res = await resultsRoute.GET(new Request('https://app.test/api/agent-results?month=2026-10'));
    expect(res.status).toBe(200);
    expect(getAgentResults).toHaveBeenCalledWith(expect.anything(), '2026-10', 100);
  });
});

describe('GET /api/agent-settings', () => {
  it('refuses a client', async () => {
    requireAnyRole.mockResolvedValue(forbidden);
    expect((await settingsRoute.GET()).status).toBe(403);
  });

  it('gives a lead the switches but no admin facts and no edit', async () => {
    requireAnyRole.mockResolvedValue(as('intern'));
    const body = await (await settingsRoute.GET()).json();
    expect(body.canEdit).toBe(false);
    expect(body.admin).toBeNull();
    expect(body.deployment).toEqual({ gstzen: false, browser: false });
    expect(listStaffPeople).not.toHaveBeenCalled();
  });

  it('gives an admin the staff list (staff only), usage, recipes and patches waiting', async () => {
    requireAnyRole.mockResolvedValue(as('admin'));
    const body = await (await settingsRoute.GET()).json();
    expect(body.canEdit).toBe(true);
    expect(body.admin.staff).toEqual([{ id: '11111111-1111-1111-1111-111111111111', name: 'Divya', role: 'intern' }]);
    expect(body.admin.browserHoursUsed).toBe(3);
    expect(body.admin.patchesWaiting).toBe(1);
    expect(body.admin.recipes.recipes).toBeGreaterThan(0);
  });

  it('a demo admin cannot edit', async () => {
    requireAnyRole.mockResolvedValue(as('admin', { demo: true }));
    expect((await (await settingsRoute.GET()).json()).canEdit).toBe(false);
  });
});

describe('PUT /api/agent-settings', () => {
  it.each(['manager', 'intern'])('refuses a %s through the admin guard', async () => {
    requireAdmin.mockResolvedValue(forbidden);
    expect((await settingsRoute.PUT(put({ key: 'killSwitch', value: true }))).status).toBe(403);
    expect(setAgentSetting).not.toHaveBeenCalled();
  });

  it('refuses a demo login', async () => {
    requireAdmin.mockResolvedValue(as('admin', { demo: true }));
    expect((await settingsRoute.PUT(put({ key: 'killSwitch', value: true }))).status).toBe(403);
    expect(setAgentSetting).not.toHaveBeenCalled();
  });

  it('refuses an unknown key', async () => {
    requireAdmin.mockResolvedValue(as('admin'));
    expect((await settingsRoute.PUT(put({ key: 'everything', value: true }))).status).toBe(400);
  });

  it('saves through the repository', async () => {
    requireAdmin.mockResolvedValue(as('super_admin'));
    expect((await settingsRoute.PUT(put({ key: 'killSwitch', value: true }))).status).toBe(200);
    expect(setAgentSetting).toHaveBeenCalledWith(expect.objectContaining({ role: 'super_admin' }), 'killSwitch', true);
  });

  it('will not switch on a route this deployment is not configured for', async () => {
    requireAdmin.mockResolvedValue(as('admin'));
    expect((await settingsRoute.PUT(put({ key: 'browser', value: { live: true, pilotUserIds: [] } }))).status).toBe(409);
    expect(setAgentSetting).not.toHaveBeenCalled();
  });

  it('keeps only staff in the pilot list', async () => {
    requireAdmin.mockResolvedValue(as('admin'));
    vi.stubEnv('GSTZEN_USERNAME', 'firm');
    vi.stubEnv('GSTZEN_PASSWORD', 'secret');
    const res = await settingsRoute.PUT(
      put({ key: 'gstzen', value: { live: true, pilotUserIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'nope'] } }),
    );
    expect(res.status).toBe(200);
    expect(setAgentSetting).toHaveBeenCalledWith(expect.anything(), 'gstzen', { live: true, pilotUserIds: ['11111111-1111-1111-1111-111111111111'] });
  });

  it('maps an invalid value from the repository to 400', async () => {
    requireAdmin.mockResolvedValue(as('admin'));
    setAgentSetting.mockRejectedValue(new AgentSettingsForbiddenError('That is not a valid value for idleMinutes'));
    expect((await settingsRoute.PUT(put({ key: 'idleMinutes', value: 'x' }))).status).toBe(400);
  });
});
