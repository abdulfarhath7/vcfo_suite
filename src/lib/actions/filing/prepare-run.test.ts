// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { ActionContext } from '../types';

/** The hand-off to VCFO Assist: behind its flag, a person's click only, and nowhere for a secret to go. */

const ENGAGEMENT = 'e0000000-0000-4000-8000-000000000001';
const FILING = 'f0000000-0000-4000-8000-000000000001';
const RUN = 'a0000000-0000-4000-8000-000000000001';

const assist = vi.hoisted(() => ({
  listAssistRuns: vi.fn(),
  requestAssistRun: vi.fn(),
  ingestAssistRun: vi.fn(),
  AssistForbiddenError: class extends Error {},
}));
const statutory = vi.hoisted(() => ({ scopedStatutory: vi.fn() }));
const registration = vi.hoisted(() => ({ rowOf: vi.fn() }));

vi.mock('@/db/repositories/assist-runs', () => assist);
vi.mock('@/db/repositories/compliance-statutory', () => statutory);
vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: vi.fn() }));
vi.mock('../registrations', () => registration);

const { prepareRun } = await import('./prepare-run');

const lead: AuthContext = { userId: 'u1', email: 'lead@x.test', name: 'Lead', role: 'intern', internId: 'i1' };
const actx: ActionContext = { auth: lead, engagementId: ENGAGEMENT, conversationId: null, runId: null, now: new Date('2026-11-06T00:00:00Z'), via: 'ask' };
const filing = { kind: 'filing' as const, itemId: FILING };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ASK_ASSIST_HANDOFF_ENABLED = 'true';
  process.env.VCFO_ASSIST_ENABLED = 'on';
  statutory.scopedStatutory.mockResolvedValue({ inst: { engagementId: ENGAGEMENT, filedOn: null, periodLabel: 'Oct 2026' }, obligation: { particular: 'GSTR-3B' } });
  assist.listAssistRuns.mockResolvedValue([]);
  assist.requestAssistRun.mockResolvedValue({ id: RUN });
});
afterEach(() => {
  delete process.env.ASK_ASSIST_HANDOFF_ENABLED;
  delete process.env.VCFO_ASSIST_ENABLED;
});

describe('filing.prepareRun with the flag off', () => {
  beforeEach(() => {
    delete process.env.ASK_ASSIST_HANDOFF_ENABLED;
  });

  it('is off by default, and is not offered', () => {
    expect(prepareRun.available!()).toBe(false);
  });

  it('refuses both to propose and to run, and touches nothing', async () => {
    await expect(prepareRun.preview(actx, filing)).rejects.toThrow('switched off');
    expect(await prepareRun.execute(actx, filing)).toEqual({ ok: false, error: 'Preparing a filing run is switched off for now.' });
    expect(assist.requestAssistRun).not.toHaveBeenCalled();
    expect(statutory.scopedStatutory).not.toHaveBeenCalled();
  });

  it('stays off when the flag is on but the extension link is not set up', async () => {
    process.env.ASK_ASSIST_HANDOFF_ENABLED = 'true';
    delete process.env.VCFO_ASSIST_ENABLED;
    expect(prepareRun.available!()).toBe(false);
    await expect(prepareRun.preview(actx, filing)).rejects.toThrow('switched off');
  });
});

describe('filing.prepareRun with the flag on', () => {
  it('is a card a person approves, for staff only', () => {
    expect(prepareRun.available!()).toBe(true);
    expect(prepareRun.tier).toBe('T2');
    expect(prepareRun.roles).toEqual(['super_admin', 'admin', 'manager', 'intern']);
  });

  it('previews without writing, and says a person finishes it', async () => {
    const draft = await prepareRun.preview(actx, filing);
    expect(draft).toMatchObject({ tier: 'T2', engagementId: ENGAGEMENT, title: 'Prepare a filing run' });
    expect(draft!.rows[0]).toMatchObject({ action: 'filing.prepareRun', target: filing, label: 'GSTR-3B, Oct 2026', displayOld: 'Not started' });
    expect(draft!.rows[0]!.displayNew).toContain('You sign in, sign, pay, submit');
    expect(assist.requestAssistRun).not.toHaveBeenCalled();
    expect(assist.ingestAssistRun).not.toHaveBeenCalled();
  });

  it('stores a requested run as the person, with the form from the record', async () => {
    const result = await prepareRun.execute(actx, filing);
    expect(result).toMatchObject({ ok: true, undo: { runId: RUN } });
    expect(assist.requestAssistRun).toHaveBeenCalledWith(lead, { engagementId: ENGAGEMENT, subjectKind: 'filing', subjectKey: FILING, form: 'GSTR-3B' });
  });

  it('prepares a registration with the form the screen shows', async () => {
    registration.rowOf.mockResolvedValue({ word: 'Not started', name: 'GST', form: 'REG-01', item: { forms: [] } });
    await prepareRun.execute(actx, { kind: 'registration', itemId: 'reg-4' });
    expect(assist.requestAssistRun).toHaveBeenCalledWith(lead, { engagementId: ENGAGEMENT, subjectKind: 'registration', subjectKey: 'reg-4', form: 'REG-01' });
  });

  it('refuses a filed period, a finished registration and an open run, as the screen does', async () => {
    statutory.scopedStatutory.mockResolvedValueOnce({ inst: { engagementId: ENGAGEMENT, filedOn: '2026-10-01', periodLabel: null }, obligation: { particular: 'GSTR-3B' } });
    await expect(prepareRun.preview(actx, filing)).rejects.toThrow('already filed');
    registration.rowOf.mockResolvedValueOnce({ word: 'Done', name: 'GST', form: '', item: { forms: [] } });
    await expect(prepareRun.preview(actx, { kind: 'registration', itemId: 'reg-4' })).rejects.toThrow('needs no filing run');
    assist.listAssistRuns.mockResolvedValueOnce([{ id: RUN, state: 'running' }]);
    await expect(prepareRun.preview(actx, filing)).rejects.toThrow('already open');
  });

  it('refuses a filing on another client as if it did not exist', async () => {
    statutory.scopedStatutory.mockResolvedValueOnce({ inst: { engagementId: 'e0000000-0000-4000-8000-000000000002', filedOn: null }, obligation: { particular: 'GSTR-3B' } });
    await expect(prepareRun.preview(actx, filing)).rejects.toThrow('not on this project');
    assist.listAssistRuns.mockResolvedValueOnce(null);
    await expect(prepareRun.preview(actx, filing)).rejects.toThrow('not on this project');
  });

  it('takes the run back only while it is still a request', async () => {
    const undo = { runId: RUN, kind: 'filing', itemId: FILING };
    assist.listAssistRuns.mockResolvedValueOnce([{ id: RUN, state: 'running' }]);
    expect((await prepareRun.undo!(actx, undo)).ok).toBe(false);
    expect(assist.ingestAssistRun).not.toHaveBeenCalled();
    assist.listAssistRuns.mockResolvedValueOnce([{ id: RUN, state: 'requested' }]);
    expect((await prepareRun.undo!(actx, undo)).ok).toBe(true);
    expect(assist.ingestAssistRun).toHaveBeenCalledWith(lead, ENGAGEMENT, { runId: RUN, state: 'stopped' });
  });
});

describe('what the action can carry', () => {
  it('takes a kind and an id, so a login, OTP, DSC PIN or token has no field and is dropped', async () => {
    const parsed = prepareRun.input.parse({ ...filing, otp: '123456', password: 'Secret@123', dscPin: '4321', token: 'abc', username: 'U1', form: 'OTP 123456', value: 'x' });
    expect(parsed).toEqual(filing);
    const draft = await prepareRun.preview(actx, parsed);
    expect(JSON.stringify(draft)).not.toMatch(/123456|Secret@123|4321|otp|password/i);
    await prepareRun.execute(actx, parsed);
    expect(JSON.stringify(assist.requestAssistRun.mock.calls)).not.toMatch(/123456|Secret@123|4321/);
  });

  it('refuses an id that could hold free text', () => {
    for (const itemId of ['OTP 123456', 'password=abc', 'reg-4 pin 1234', '']) expect(prepareRun.input.safeParse({ kind: 'filing', itemId }).success).toBe(false);
  });

  it('never moves a run past the request: no action submits, signs or pays', async () => {
    const { actions } = await import('./index');
    expect(actions.map((action) => action.name)).toEqual(['filing.prepareRun']);
    await prepareRun.execute(actx, filing);
    expect(assist.ingestAssistRun).not.toHaveBeenCalled();
  });
});
