// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import { changesetHash } from '@/lib/ask/changeset/hash';
import type { ChangesetDraft } from '@/lib/ask/changeset/types';
import type { AnyAction } from '@/lib/actions/types';

/**
 * The overnight job with the real registry and the real action previews, stopped at the repositories.
 * Every action's `execute` and `undo` is watched across all roles, and none may run.
 */
vi.setConfig({ testTimeout: 60_000 });

const ENGAGEMENT = 'e0000000-0000-4000-8000-000000000001';
const OTHER = 'e0000000-0000-4000-8000-000000000002';
const REQUEST = 'a0000000-0000-4000-8000-000000000001';
const FILING = 'a0000000-0000-4000-8000-000000000002';
const DOCUMENT = 'a0000000-0000-4000-8000-000000000003';
const PROPOSAL = 'a0000000-0000-4000-8000-000000000004';
const NOW = new Date('2026-11-06T21:00:00Z');

const repos = vi.hoisted(() => ({
  listOwnScheduledRows: vi.fn(),
  createAskChangeset: vi.fn(),
  createAskRun: vi.fn(),
  lockAskRun: vi.fn(),
  updateAskRun: vi.fn(),
  appendAskRunStep: vi.fn(),
  systemLoadAskOwner: vi.fn(),
  systemTodayTokenTotal: vi.fn(),
  createNotificationsForUsers: vi.fn(),
  listOverdueWaitingFilings: vi.fn(),
  systemProactiveOwners: vi.fn(),
  listVaultRequests: vi.fn(),
  listDocuments: vi.fn(),
  getDocumentById: vi.fn(),
  listCalendarProposals: vi.fn(),
  resolveReminderTarget: vi.fn(),
  lastReminderWithinWindow: vi.fn(),
  resolveEngagementRecipients: vi.fn(),
  systemJobsPaused: vi.fn(),
}));

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/db/repositories/ask-changesets', async (load) => ({ ...(await load<object>()), listOwnScheduledRows: repos.listOwnScheduledRows, createAskChangeset: repos.createAskChangeset }));
vi.mock('@/db/repositories/ask-runs', async (load) => ({ ...(await load<object>()), createAskRun: repos.createAskRun, lockAskRun: repos.lockAskRun, updateAskRun: repos.updateAskRun, appendAskRunStep: repos.appendAskRunStep, systemLoadAskOwner: repos.systemLoadAskOwner }));
vi.mock('@/db/repositories/ask-usage', async (load) => ({ ...(await load<object>()), systemTodayTokenTotal: repos.systemTodayTokenTotal }));
vi.mock('@/db/repositories/notifications', async (load) => ({ ...(await load<object>()), createNotificationsForUsers: repos.createNotificationsForUsers }));
vi.mock('@/db/repositories/ask-proactive', () => ({ listOverdueWaitingFilings: repos.listOverdueWaitingFilings, systemProactiveOwners: repos.systemProactiveOwners }));
vi.mock('@/db/repositories/documents', async (load) => ({ ...(await load<object>()), listVaultRequests: repos.listVaultRequests, listDocuments: repos.listDocuments, getDocumentById: repos.getDocumentById }));
vi.mock('@/db/repositories/reg-proposals', async (load) => ({ ...(await load<object>()), listCalendarProposals: repos.listCalendarProposals }));
vi.mock('@/db/repositories/client-reminders', async (load) => ({ ...(await load<object>()), resolveReminderTarget: repos.resolveReminderTarget, lastReminderWithinWindow: repos.lastReminderWithinWindow }));
vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: repos.resolveEngagementRecipients }));
vi.mock('@/db/repositories/dev-settings', async (load) => ({ ...(await load<object>()), systemJobsPaused: repos.systemJobsPaused }));

const { prepareForOwner } = await import('./prepare');
const { runProactive } = await import('@/jobs/ask-proactive');
const { actionsForRole } = await import('@/lib/actions/registry');

const person = (role: AppRole): AuthContext => ({ userId: `user-${role}`, email: `${role}@x.test`, name: role, role, internId: role === 'intern' ? 'i1' : undefined });
const owner = { ownerId: 'user-intern', engagements: [{ id: ENGAGEMENT, companyName: 'Acme' }] };
const managerOwner = { ownerId: 'user-manager', engagements: [] };

const draftsMade = () => repos.createAskChangeset.mock.calls.map(([, input]) => (input as { draft: ChangesetDraft }).draft);
const rowsMade = () => draftsMade().flatMap((draft) => draft.rows);

let watched: Array<ReturnType<typeof vi.spyOn>> = [];

beforeAll(async () => {
  const seen = new Set<AnyAction>();
  for (const role of ['super_admin', 'admin', 'manager', 'intern', 'client'] as AppRole[]) for (const action of await actionsForRole(role)) seen.add(action);
  expect(seen.size).toBeGreaterThan(90);
  watched = [...seen].flatMap((action) => [vi.spyOn(action, 'execute'), ...(action.undo ? [vi.spyOn(action, 'undo' as never)] : [])]);
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ASK_VCFO_ENABLED', 'true');
  vi.stubEnv('ASK_PROACTIVE_ENABLED', 'true');
  vi.stubEnv('WATCH_ENABLED', 'true');
  repos.systemLoadAskOwner.mockImplementation(async (id: string) => person(id.replace('user-', '') as AppRole));
  repos.systemTodayTokenTotal.mockResolvedValue(0);
  repos.listOwnScheduledRows.mockResolvedValue([]);
  repos.createAskRun.mockResolvedValue({ id: 'run-1' });
  repos.createAskChangeset.mockImplementation(async () => `card-${repos.createAskChangeset.mock.calls.length}`);
  repos.createNotificationsForUsers.mockResolvedValue([]);
  repos.resolveEngagementRecipients.mockResolvedValue({ clients: [{ name: 'Asha', email: 'asha@x.test' }] });
  repos.listVaultRequests.mockResolvedValue([{ id: REQUEST, title: 'Rent agreement', status: 'pending', dueOn: '2026-10-01', files: [] }]);
  repos.listOverdueWaitingFilings.mockResolvedValue([{ id: FILING }]);
  repos.listDocuments.mockResolvedValue([{ id: DOCUMENT, fileName: 'noc.pdf', reviewStatus: 'pending', stepId: 'pre-14', replacedAt: null, createdAt: '2026-11-01T00:00:00Z' }]);
  repos.getDocumentById.mockResolvedValue({ id: DOCUMENT, engagementId: ENGAGEMENT, fileName: 'noc.pdf', reviewStatus: 'pending', uploadedByName: 'Asha' });
  repos.listCalendarProposals.mockResolvedValue([]);
  repos.resolveReminderTarget.mockImplementation(async (_ctx: unknown, _id: string, key: string) => ({ ok: true, target: { engagementDbId: ENGAGEMENT, itemKey: key, itemTitle: key.startsWith('request') ? 'Rent agreement' : 'GSTR-3B' } }));
  repos.lastReminderWithinWindow.mockResolvedValue(null);
  repos.systemJobsPaused.mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const spy of watched) expect(spy).not.toHaveBeenCalled();
});

describe('with the flag off', () => {
  it('is off by default, and reads nothing', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('ASK_VCFO_ENABLED', 'true');
    expect(await prepareForOwner(owner, NOW)).toEqual({ stopped: 'off' });
    expect(repos.systemLoadAskOwner).not.toHaveBeenCalled();
    expect(repos.createAskRun).not.toHaveBeenCalled();
  });

  it('the job stops at once and finds no owners', async () => {
    vi.stubEnv('ASK_PROACTIVE_ENABLED', 'false');
    const step = { run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()) };
    expect(await runProactive(step)).toEqual({ skipped: 'off' });
    expect(step.run).not.toHaveBeenCalled();
  });
});

describe('with the flag on', () => {
  it('leaves one card per project, proposed, as the named owner', async () => {
    expect(await prepareForOwner(owner, NOW)).toEqual({ cards: 1, rows: 3 });
    const ctx = person('intern');
    expect(repos.listVaultRequests).toHaveBeenCalledWith(ctx, ENGAGEMENT);
    expect(repos.createAskRun).toHaveBeenCalledWith(ctx, expect.objectContaining({ trigger: 'schedule', workflow: 'proactive', conversationId: null }));
    expect(repos.lockAskRun).toHaveBeenCalledWith(ctx, 'run-1', ENGAGEMENT);
    expect(repos.updateAskRun).toHaveBeenCalledWith(ctx, 'run-1', { status: 'waiting_approval' });
    const [draft] = draftsMade();
    expect(draft).toMatchObject({ tier: 'T3', engagementId: ENGAGEMENT, title: '3 changes to review' });
    expect(draft!.recipients?.map((p) => p.name)).toEqual(expect.arrayContaining(['Asha']));
    expect(rowsMade().map((row) => row.action)).toEqual(['reminders.sendClient', 'reminders.sendClient', 'documents.review']);
    expect(rowsMade()[0]!.target).toEqual({ itemKey: `request:${REQUEST}`, cardRecipients: expect.any(Array) });
    expect(rowsMade()[1]!.target).toEqual({ itemKey: `filing:${FILING}`, cardRecipients: expect.any(Array) });
  });

  it('asks the person to open a file first, on the row, without blocking it', async () => {
    await prepareForOwner(owner, NOW);
    const row = rowsMade().find((r) => r.action === 'documents.review')!;
    expect(row.target).toEqual({ documentId: DOCUMENT, status: 'approved', reviewAtCard: expect.any(String), cardRecipients: expect.any(Array) });
    expect(row.checks).toEqual([{ rule: 'open_first', ok: false, message: expect.stringContaining('Open this file') }]);
    const { rowCanApply } = await import('@/lib/actions/checklist/rules');
    expect(rowCanApply(row.checks)).toBe(true);
  });

  it('tells only the owner, once, with a link holding every card', async () => {
    repos.listVaultRequests.mockImplementation(async (_ctx: unknown, id: string) => [{ id: id === ENGAGEMENT ? REQUEST : FILING, status: 'pending', dueOn: '2026-10-01', files: [] }]);
    repos.listOverdueWaitingFilings.mockResolvedValue([]);
    await prepareForOwner({ ownerId: 'user-intern', engagements: [{ id: ENGAGEMENT, companyName: 'Acme' }, { id: OTHER, companyName: 'Beta' }] }, NOW);
    expect(repos.createNotificationsForUsers).toHaveBeenCalledTimes(1);
    const [[notice]] = repos.createNotificationsForUsers.mock.calls[0]! as [[Record<string, string>]];
    expect(notice).toMatchObject({ userId: 'user-intern', kind: 'ask.proposal', href: '/app/intern/ask?changeset=card-1&changeset=card-2' });
    expect(notice.body).toContain('Acme, Beta');
    expect(notice.body).toContain('Nothing is saved or sent until you accept');
  });

  it('says nothing on a night with nothing to propose, and makes no run', async () => {
    repos.listVaultRequests.mockResolvedValue([]);
    repos.listOverdueWaitingFilings.mockResolvedValue([]);
    repos.listDocuments.mockResolvedValue([]);
    expect(await prepareForOwner(owner, NOW)).toEqual({ cards: 0, rows: 0 });
    expect(repos.createAskRun).not.toHaveBeenCalled();
    expect(repos.createNotificationsForUsers).not.toHaveBeenCalled();
  });

  it('leaves out what is not due, already sent in, reminded today or too new', async () => {
    repos.listVaultRequests.mockResolvedValue([
      { id: REQUEST, status: 'pending', dueOn: '2026-12-01', files: [] },
      { id: FILING, status: 'pending', dueOn: '2026-10-01', files: [{}] },
      { id: DOCUMENT, status: 'fulfilled', dueOn: '2026-10-01', files: [] },
      { id: PROPOSAL, status: 'pending', dueOn: null, files: [] },
    ]);
    repos.listOverdueWaitingFilings.mockResolvedValue([{ id: FILING }]);
    repos.lastReminderWithinWindow.mockResolvedValue(new Date());
    repos.listDocuments.mockResolvedValue([
      { id: DOCUMENT, reviewStatus: 'pending', stepId: 'pre-14', replacedAt: null, createdAt: NOW.toISOString() },
      { id: DOCUMENT, reviewStatus: 'approved', stepId: 'pre-14', replacedAt: null, createdAt: '2026-11-01T00:00:00Z' },
      { id: DOCUMENT, reviewStatus: 'pending', stepId: null, replacedAt: null, createdAt: '2026-11-01T00:00:00Z' },
      { id: DOCUMENT, reviewStatus: 'pending', stepId: 'pre-14', replacedAt: '2026-11-02T00:00:00Z', createdAt: '2026-11-01T00:00:00Z' },
    ]);
    expect(await prepareForOwner(owner, NOW)).toEqual({ cards: 0, rows: 0 });
  });

  it('does not propose a reminder when the client has nobody to hear it', async () => {
    repos.resolveEngagementRecipients.mockResolvedValue({ clients: [] });
    await prepareForOwner(owner, NOW);
    expect(rowsMade().map((row) => row.action)).toEqual(['documents.review']);
  });

  it('does not propose again what was proposed in the last fortnight, whatever became of it', async () => {
    repos.listOwnScheduledRows.mockResolvedValue([{ action: 'reminders.sendClient', target: { itemKey: `request:${REQUEST}` } }]);
    await prepareForOwner(owner, NOW);
    const since = repos.listOwnScheduledRows.mock.calls[0]![1] as Date;
    expect((NOW.getTime() - since.getTime()) / 86_400_000).toBe(14);
    expect(rowsMade().map((row) => row.target)).toEqual([{ itemKey: `filing:${FILING}`, cardRecipients: expect.any(Array) }, { documentId: DOCUMENT, status: 'approved', reviewAtCard: expect.any(String), cardRecipients: expect.any(Array) }]);
    // A second run sees its own work and adds nothing, so a retried step cannot double a card.
    repos.listOwnScheduledRows.mockResolvedValue([{ action: 'reminders.sendClient', target: { itemKey: `request:${REQUEST}` } }, ...rowsMade().map((row) => ({ action: row.action, target: row.target }))]);
    repos.createAskChangeset.mockClear();
    expect(await prepareForOwner(owner, NOW)).toEqual({ cards: 0, rows: 0 });
  });

  it('treats a refusal as nothing to propose, and a fault on one project as that project only', async () => {
    repos.getDocumentById.mockResolvedValue(null);
    await prepareForOwner(owner, NOW);
    expect(rowsMade().map((row) => row.action)).toEqual(['reminders.sendClient', 'reminders.sendClient']);
    repos.createAskChangeset.mockClear();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    repos.listVaultRequests.mockImplementation(async (_ctx: unknown, id: string) => {
      if (id === ENGAGEMENT) throw new Error('boom');
      return [{ id: REQUEST, status: 'pending', dueOn: '2026-10-01', files: [] }];
    });
    const result = await prepareForOwner({ ownerId: 'user-intern', engagements: [{ id: ENGAGEMENT, companyName: 'Acme' }, { id: OTHER, companyName: 'Beta' }] }, NOW);
    expect(result).toMatchObject({ cards: 1 });
    quiet.mockRestore();
  });

  it('caps what one person is sent in one night', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `e0000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, companyName: `Client ${i}` }));
    repos.listVaultRequests.mockImplementation(async (_ctx: unknown, id: string) => Array.from({ length: 30 }, (_, i) => ({ id: `b${id.slice(-3)}000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`, status: 'pending', dueOn: '2026-10-01', files: [] })));
    repos.listOverdueWaitingFilings.mockResolvedValue([]);
    repos.listDocuments.mockResolvedValue([]);
    const result = await prepareForOwner({ ownerId: 'user-intern', engagements: many }, NOW);
    expect(result).toEqual({ cards: 10, rows: 100 });
    expect(draftsMade().every((draft) => draft.rows.length === 10)).toBe(true);
  });
});

describe('the same limits as chat', () => {
  it('stops on the path and T2 kill switches, the daily budget and Ask being off', async () => {
    vi.stubEnv('ASK_KILL_PATHS', 'fixed_workflow');
    expect(await prepareForOwner(owner, NOW)).toEqual({ stopped: 'switched off' });
    vi.stubEnv('ASK_KILL_PATHS', '');
    vi.stubEnv('ASK_KILL_TIERS', 'T2');
    expect(await prepareForOwner(owner, NOW)).toEqual({ stopped: 'switched off' });
    vi.stubEnv('ASK_KILL_TIERS', '');
    repos.systemTodayTokenTotal.mockResolvedValue(2_000_000);
    expect(await prepareForOwner(owner, NOW)).toEqual({ stopped: 'daily budget' });
    repos.systemTodayTokenTotal.mockResolvedValue(0);
    vi.stubEnv('ASK_VCFO_ENABLED', 'false');
    expect(await prepareForOwner(owner, NOW)).toEqual({ stopped: 'off' });
    expect(repos.createAskRun).not.toHaveBeenCalled();
  });

  it('drops a switched-off tier and keeps the rest', async () => {
    vi.stubEnv('ASK_KILL_TIERS', 'T3');
    expect(await prepareForOwner(owner, NOW)).toEqual({ cards: 0, rows: 0 });
  });

  it('stops for an owner who has gone, or who has lost Ask VCFO', async () => {
    repos.systemLoadAskOwner.mockResolvedValue(null);
    expect(await prepareForOwner(owner, NOW)).toEqual({ stopped: 'owner not active' });
  });
});

describe('calendar follow-up', () => {
  const proposal = { id: PROPOSAL, status: 'proposed', obligationName: 'GSTR-1', period: 'Oct 2026', oldDueDate: '2026-11-11', newDueDate: '2026-11-13', total: 4, updateTitle: 'Notification 12', clients: [{ engagementId: ENGAGEMENT, companyName: 'Acme' }] };

  it('puts a waiting change on a card of its own for a manager, on no project', async () => {
    repos.listCalendarProposals.mockResolvedValue([proposal, { ...proposal, id: 'x', status: 'approved' }, { ...proposal, id: 'y', clients: [] }]);
    expect(await prepareForOwner(managerOwner, NOW)).toEqual({ cards: 1, rows: 1 });
    expect(repos.lockAskRun).not.toHaveBeenCalled();
    expect(draftsMade()[0]).toMatchObject({ tier: 'T2', engagementId: null, title: 'Approve a due date change' });
    expect(rowsMade()[0]).toMatchObject({ action: 'compliance.approveCalendarChange', target: { proposalId: PROPOSAL }, displayOld: 'Due 2026-11-11' });
    expect(rowsMade()[0]!.displayNew).toContain('for 4 clients');
  });

  it('never goes to a lead, or anywhere while Watch is off', async () => {
    repos.listCalendarProposals.mockResolvedValue([proposal]);
    repos.listVaultRequests.mockResolvedValue([]);
    repos.listOverdueWaitingFilings.mockResolvedValue([]);
    repos.listDocuments.mockResolvedValue([]);
    expect(await prepareForOwner(owner, NOW)).toEqual({ cards: 0, rows: 0 });
    vi.stubEnv('WATCH_ENABLED', 'false');
    expect(await prepareForOwner(managerOwner, NOW)).toEqual({ cards: 0, rows: 0 });
    expect(repos.listCalendarProposals).not.toHaveBeenCalled();
  });
});

describe('the job', () => {
  const step = () => ({ run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()) });

  it('runs one step per owner and adds up what they left', async () => {
    repos.systemProactiveOwners.mockResolvedValue([owner, { ownerId: 'user-manager', engagements: [{ id: ENGAGEMENT, companyName: 'Acme' }] }]);
    const s = step();
    expect(await runProactive(s)).toEqual({ owners: 2, cards: 2, rows: 6 });
    expect(s.run.mock.calls.map(([name]) => name)).toEqual(['check-paused', 'owners', 'owner-user-intern', 'owner-user-manager']);
  });

  it('honours "Pause all jobs"', async () => {
    repos.systemJobsPaused.mockResolvedValue(true);
    expect(await runProactive(step())).toEqual({ skipped: 'paused' });
    expect(repos.systemProactiveOwners).not.toHaveBeenCalled();
  });

  it('counts nothing for an owner who was stopped', async () => {
    repos.systemProactiveOwners.mockResolvedValue([owner]);
    repos.systemTodayTokenTotal.mockResolvedValue(2_000_000);
    expect(await runProactive(step())).toEqual({ owners: 1, cards: 0, rows: 0 });
  });
});

describe('seen keys', () => {
  it('ignore the order of a target\'s keys', () => {
    const a = changesetHash([{ action: 'x', target: { a: 1, b: 2 }, newValue: null }]);
    const b = changesetHash([{ action: 'x', target: { b: 2, a: 1 }, newValue: null }]);
    expect(a).toBe(b);
  });
});
