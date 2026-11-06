import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { LlmRequest, LlmResult } from '@/lib/ask/provider';

/**
 * Work asked for in words: one action makes a card and writes nothing, open-ended work starts a
 * durable run, a run is locked to one client, and a kill switch answers with a clear sentence.
 */
vi.mock('@/db/client', () => ({ db: {} }));

const manager: AuthContext = { userId: 'mgr-1', email: 'm@x.test', name: 'Manager', role: 'manager' };
const lead: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern' };
const acme = { id: 'a0000000-0000-4000-8000-00000000000a', slug: 'acme', companyName: 'Acme Robotics Private Limited' };
const kestrel = { id: 'b0000000-0000-4000-8000-00000000000b', slug: 'kestrel', companyName: 'Kestrel Robotics Pvt Ltd' };

const updateRun = vi.fn();
const createRun = vi.fn(async (_c: unknown, _i: { kind?: string; goal: string }) => ({ id: 'run-1' }));
const lockRun = vi.fn(async () => true);
const answer = vi.fn();
vi.mock('@/db/repositories/ask-runs', () => ({
  createAskRun: (...a: [unknown, never]) => createRun(...a),
  updateAskRun: (...a: unknown[]) => updateRun(...a),
  lockAskRun: (...a: unknown[]) => (lockRun as (...x: unknown[]) => Promise<boolean>)(...a),
  appendAskRunStep: vi.fn(),
  setAskRunAnswer: (...a: unknown[]) => answer(...a),
  systemLoadAskRun: vi.fn(),
}));
const createCard = vi.fn(async (_c: unknown, _i: { draft: { engagementId: string | null; tier: string; recipients?: unknown[]; rows: Array<{ target: object }> } }) => 'c0000000-0000-4000-8000-00000000000c');
vi.mock('@/db/repositories/ask-changesets', () => ({ createAskChangeset: (...a: [unknown, never]) => createCard(...a) }));
vi.mock('@/db/repositories/notifications', () => ({ createNotificationsForUsers: vi.fn(async () => []) }));
vi.mock('@/db/repositories/engagement-managers-membership', () => ({ listManagerIdsForEngagement: async () => [] }));
vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: async () => ({ clients: [{ userId: 'c', name: 'Client Person', email: 'c@x.test' }], leads: [{ name: 'Lena Lead', email: 'lena@firm.test' }], managers: [] }) }));
const createTask = vi.fn();
vi.mock('@/db/repositories/compliance-tasks', () => ({ createTask: (...a: unknown[]) => createTask(...a), ComplianceTaskError: class extends Error {} }));
const send = vi.fn(async () => undefined as unknown);
vi.mock('@/jobs/client', () => ({ inngest: { send: (...a: unknown[]) => send(...(a as [])) } }));

let reply: LlmResult['content'] = [];
const calls: LlmRequest[] = [];
const provider = {
  name: 'mock',
  complete: async (req: LlmRequest): Promise<LlmResult> => {
    calls.push(req);
    return { model: req.model, content: reply, stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
  },
};
const tool = (name: string, input: unknown = {}) => [{ type: 'tool_use', id: 't', name, input }] as unknown as LlmResult['content'];

const { handleWork } = await import('./work');
const { getAction } = await import('@/lib/actions/registry');
// Every action area loads on first use, which is slow on a busy machine, so it happens before the timed tests.
await getAction('tasks.create');

const go = (message: string, extra: { ctx?: AuthContext; shell?: 'admin' | 'client'; own?: boolean; page?: string; resumed?: Parameters<typeof handleWork>[2]['resumed'] } = {}) =>
  handleWork(extra.ctx ?? manager, { shell: extra.shell ?? 'admin', page: extra.page ? { path: extra.page } : undefined }, {
    message,
    onScreen: null,
    conversationId: 'e0000000-0000-4000-8000-00000000000e',
    now: new Date('2026-11-06T10:00:00Z'),
    engagements: async () => (extra.own ? [kestrel] : [acme, kestrel]),
    provider: async () => provider,
    resumed: extra.resumed,
  });

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  reply = [];
  send.mockResolvedValue(undefined);
  delete process.env.ASK_KILL_PATHS;
});

describe('handleWork for a client', () => {
  const client: AuthContext = { userId: 'client-1', email: 'c@x.test', name: 'Cora', role: 'client' };
  const asClient = (message: string) => go(message, { ctx: client, shell: 'client', own: true });

  it('offers the small model only what a client can fill in one message', async () => {
    reply = [{ type: 'text', text: 'No.' }] as LlmResult['content'];
    await asClient('Please delete the other company');
    expect(calls[0]!.tools!.map((t) => t.name).sort()).toEqual(['client-portal__sendMessage', 'fill_details', 'open_ended']);
  });

  it('makes a card on their own company with no company in the input, naming the lead without an email', async () => {
    reply = tool('client-portal__sendMessage', { body: 'When is the next filing?', engagementId: acme.id });
    const outcome = await asClient('Tell my lead I asked when the next filing is');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    const { draft } = createCard.mock.calls[0]![1];
    expect(draft.engagementId).toBe(kestrel.id);
    expect(draft.recipients).toEqual([{ name: 'Lena Lead', role: 'Project lead' }]);
    expect(lockRun).toHaveBeenCalledWith(client, 'run-1', kestrel.id);
  });

  it('refuses a company it was named, and a staff action the model made up', async () => {
    reply = tool('client-portal__sendMessage', { body: 'Hello' });
    const named = await asClient('Send this for Zeta Industries Pvt Ltd');
    if (named.kind !== 'answer') throw new Error(named.kind);
    expect(named.answer.line).toMatch(/cannot find Zeta Industries Pvt Ltd/);
    reply = tool('requests__create', { label: 'Rent' });
    expect((await asClient('Ask for the rent agreement')).kind).toBe('none');
    expect(createCard).not.toHaveBeenCalled();
  });

  it('runs open-ended work locked to their company', async () => {
    reply = tool('open_ended');
    const outcome = await asClient('Sort out what is pending for me');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.path).toBe('agent_run');
    expect(lockRun).toHaveBeenCalledWith(client, 'run-1', kestrel.id);
  });
});

describe('handleWork', () => {
  it('gives the small model only the actions one message can fill, plus the two ways out', async () => {
    reply = [{ type: 'text', text: 'I cannot do that here.' }] as LlmResult['content'];
    expect((await go('File the INC-20A on the MCA portal for Acme')).kind).toBe('none');
    expect(calls[0]!.model).toBe('claude-haiku-5-5');
    const names = calls[0]!.tools!.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['fill_details', 'notes__add', 'open_ended', 'requests__create', 'tasks__create']));
    const actionNames = names.filter((name) => !['fill_details', 'open_ended', 'receivables_work'].includes(name));
    for (const action of await Promise.all(actionNames.map((name) => getAction(name.replace('__', '.'))))) expect(action?.simple).toBe(true);
    expect(createRun).not.toHaveBeenCalled();
  });

  it('leaves out what the role may not do', async () => {
    reply = tool('open_ended');
    await go('Create a task for Acme', { ctx: lead });
    expect(calls[0]!.tools!.map((t) => t.name)).not.toContain('tasks__create');
  });

  it('sends a message of facts to the data router', async () => {
    reply = tool('fill_details');
    expect((await go('Registered office PIN for Acme is 500001')).kind).toBe('data');
  });

  it('turns one action into a card for the client named, and writes nothing', async () => {
    reply = tool('tasks__create', { name: 'Collect minutes', dueDate: '2026-12-15' });
    const outcome = await go('Create a task for Acme to collect minutes by 15 December');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.answer.changesetId).toBeTruthy();
    expect(outcome.answer.line).toMatch(/Nothing is saved until you accept/);
    expect(createCard.mock.calls[0]![1].draft.engagementId).toBe(acme.id);
    expect(createTask).not.toHaveBeenCalled();
    expect(lockRun).toHaveBeenCalledWith(manager, 'run-1', acme.id);
    expect(updateRun.mock.calls.at(-1)![2].status).toBe('waiting_approval');
    expect(outcome.path).toBe('fixed_workflow');
  });

  it('T3: says nothing goes out until confirmed, with recipients from code', async () => {
    reply = tool('requests__create', { label: 'Rent agreement' });
    const outcome = await go('Ask Kestrel for the rent agreement');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.answer.line).toMatch(/Nothing goes out until you confirm/);
    expect(createCard.mock.calls[0]![1].draft.recipients).toEqual([{ name: 'Client Person', email: 'c@x.test', role: 'Client' }]);
  });

  it('does not run an action the role may not use, whatever the model returns', async () => {
    reply = tool('tasks__create', { name: 'x', dueDate: '2026-12-15' });
    expect((await go('Create a task for Acme', { ctx: lead })).kind).toBe('none');
    expect(createCard).not.toHaveBeenCalled();
  });

  it('asks which project when none is known, and keeps the choice for the reply', async () => {
    reply = tool('open_ended');
    const outcome = await go('Chase whatever is overdue');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.answer.line).toBe('Which project is this for?');
    const saved = updateRun.mock.calls.at(-1)![2];
    expect(saved.status).toBe('waiting_reply');
    expect(saved.state.pick).toEqual({ kind: 'agent' });
    expect(send).not.toHaveBeenCalled();

    calls.length = 0;
    const resumed = await go('Chase whatever is overdue', { resumed: { run: { id: 'run-2' } as never, pick: { kind: 'agent' }, engagement: kestrel } });
    expect(calls).toHaveLength(0);
    expect(resumed.kind).toBe('answer');
    expect(lockRun).toHaveBeenCalledWith(manager, 'run-2', kestrel.id);
  });

  it('asks when two clients match', async () => {
    reply = tool('open_ended');
    const outcome = await go('Compare Acme Robotics and Kestrel Robotics');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.answer.line).toMatch(/More than one project matches/);
  });

  it('says so when the client named is not one of theirs', async () => {
    reply = tool('open_ended');
    const outcome = await go('Chase documents for Zenith Traders');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.answer.line).toMatch(/cannot find Zenith Traders/);
    expect(createRun).not.toHaveBeenCalled();
  });

  it('starts a locked, durable run for open-ended work, after the answer is stored', async () => {
    reply = tool('open_ended');
    const outcome = await go('Remind Acme about everything overdue and note it');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.path).toBe('agent_run');
    expect(outcome.answer.runLive).toBe(true);
    expect(createRun.mock.calls[0]![1].kind).toBe('agent');
    expect(lockRun).toHaveBeenCalledWith(manager, 'run-1', acme.id);
    expect(send).not.toHaveBeenCalled();
    await outcome.start!('m0000000-0000-4000-8000-00000000000m');
    expect(updateRun.mock.calls.at(-1)![2]).toEqual({ messageId: 'm0000000-0000-4000-8000-00000000000m' });
    expect(send).toHaveBeenCalledWith({ name: 'ask/run.start', data: { runId: 'run-1' } });
  });

  it('says so plainly when the job cannot start', async () => {
    reply = tool('open_ended');
    send.mockRejectedValueOnce(new Error('no server'));
    const outcome = await go('Remind Acme about everything overdue');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    await outcome.start!('m1');
    expect(answer.mock.calls[0]![2]).toMatch(/could not start/);
    expect(updateRun.mock.calls.at(-1)![2].status).toBe('failed');
  });

  it('answers with a clear sentence when the agent path is switched off', async () => {
    process.env.ASK_KILL_PATHS = 'agent_run';
    reply = tool('open_ended');
    const outcome = await go('Remind Acme about everything overdue');
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.answer.line).toMatch(/switched off/);
    expect(createRun).not.toHaveBeenCalled();
  });

  describe('firm-wide work, which sits on no project', () => {
    const noProjects = (message: string, page?: string) =>
      handleWork(manager, { shell: 'admin', page: page ? { path: page } : undefined }, {
        message,
        onScreen: null,
        conversationId: null,
        now: new Date('2026-11-06T10:00:00Z'),
        engagements: async () => {
          throw new Error('a firm-wide request must not look for a client');
        },
        provider: async () => provider,
      });

    it('offers the way to it only to a role that has such actions', async () => {
      reply = tool('open_ended');
      await go('Skip the reminder for invoice 42', { ctx: lead });
      expect(calls[0]!.tools!.map((t) => t.name)).not.toContain('receivables_work');
      calls.length = 0;
      await go('Skip the reminder for invoice 42 at Acme');
      expect(calls[0]!.tools!.map((t) => t.name)).toEqual(expect.arrayContaining(['receivables_work', 'receivables__markReceived']));
    });

    it('starts a run with no lock and no client named, for a person with no projects', async () => {
      reply = tool('receivables_work');
      const outcome = await noProjects('Skip the reminder for invoice SC/08/02');
      if (outcome.kind !== 'answer') throw new Error(outcome.kind);
      expect(outcome.answer.line).toBe('Working on this. Nothing is saved or sent until you accept it.');
      expect(lockRun).not.toHaveBeenCalled();
      const first = updateRun.mock.calls.find((c) => c[2].state)![2].state;
      expect(JSON.stringify(first.messages)).toContain('No client');
      expect(JSON.stringify(first.messages)).not.toContain('Client:');
    });

    it('never names the project on screen', async () => {
      reply = tool('receivables_work');
      const outcome = await noProjects('Which invoices are overdue?', '/app/admin/engagements/acme');
      if (outcome.kind !== 'answer') throw new Error(outcome.kind);
      expect(outcome.answer.line).not.toMatch(/Acme/);
      expect(lockRun).not.toHaveBeenCalled();
    });

    it('turns one firm-wide action into a card with no project on it', async () => {
      const action = (await getAction('receivables.markReceived'))!;
      const preview = vi.spyOn(action, 'preview').mockResolvedValue({ title: 'Record a receipt', tier: 'T2', engagementId: null, rows: [{ action: action.name, target: {}, label: 'SC/09/01', oldValue: null, newValue: 'x', displayOld: '', displayNew: 'x', sensitive: false, source: null, checks: [] }] });
      reply = tool('receivables__markReceived', { invoiceNo: 'SC/09/01', paidOn: '2026-11-05' });
      const outcome = await noProjects('Mark invoice SC/09/01 as paid in full on 5 November 2026.');
      if (outcome.kind !== 'answer') throw new Error(outcome.kind);
      expect(preview.mock.calls[0]![0].engagementId).toBeNull();
      expect(lockRun).not.toHaveBeenCalled();
      expect(createCard.mock.calls[0]![1].draft.engagementId).toBeNull();
      expect(outcome.answer.line).toBe('I prepared this. Nothing is saved until you accept.');
      preview.mockRestore();
    });
  });

  it('asks for smaller parts when the first look was cut short, and acts on nothing', async () => {
    reply = tool('tasks__create', { title: 'half' });
    const complete = vi.spyOn(provider, 'complete').mockImplementationOnce(async (req) => {
      calls.push(req);
      return { model: req.model, content: reply, stopReason: 'max_tokens', usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
    });
    const outcome = await go('Create these sixty tasks at Acme');
    complete.mockRestore();
    if (outcome.kind !== 'answer') throw new Error(outcome.kind);
    expect(outcome.answer.line).toContain('smaller parts');
    expect(createCard).not.toHaveBeenCalled();
    expect(calls[0]!.thinking).toBe('off');
    expect(calls[0]!.maxTokens).toBeGreaterThan(1024);
  });

  it('masks identity numbers before the small model reads the request', async () => {
    reply = tool('open_ended');
    await go('Find the director with PAN ABCDE1234F at Acme');
    expect(JSON.stringify(calls[0]!.messages)).not.toContain('ABCDE1234F');
  });
});
