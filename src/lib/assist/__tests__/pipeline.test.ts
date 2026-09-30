import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { ProjectSnapshot } from '@/data/assist/schema';
import type { LlmProvider, LlmRequest, LlmResult } from '@/lib/assist/provider';

/**
 * Pipeline routing with a mock provider — no live model calls. Covers the
 * cheapest-path-first rules and the guard outcomes.
 */

const appendAssistMessage = vi.fn();
const countModelAnswersSince = vi.fn();
const loadStaffData = vi.fn();
let snapshot: ProjectSnapshot;

vi.mock('@/db/repositories/assist-conversations', () => ({
  createAssistConversation: vi.fn(async () => ({ id: 'conv-1' })),
  getAssistConversationWithMessages: vi.fn(async () => null),
}));
vi.mock('@/db/repositories/assist-messages', () => ({
  appendAssistMessage: (...a: unknown[]) => appendAssistMessage(...a),
  countModelAnswersSince: (...a: unknown[]) => countModelAnswersSince(...a),
}));
vi.mock('@/lib/assist/snapshot', () => ({
  loadProjectSnapshot: vi.fn(async () => ({
    snapshot,
    engagementDbId: 'eng-db-1',
    engagementSlug: 'acme',
    state: {},
    filings: [],
  })),
}));
vi.mock('@/lib/assist/retrieve', () => ({ retrieveSources: vi.fn(async () => []) }));
vi.mock('@/lib/assist/tools/staff-data', () => ({ loadStaffData: (...a: unknown[]) => loadStaffData(...a) }));

const { runAssistChat } = await import('@/lib/assist/pipeline');
const { setAssistProviderForTests } = await import('@/lib/assist/provider');
const { REFUSAL_COPY } = await import('@/lib/assist/refusals');
const { AssistForbiddenError } = await import('@/lib/assist/access');

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@x.test`, name: role, role };
}

function toolUse(name: string, input: unknown, id = `tu-${name}`) {
  return { type: 'tool_use', id, name, input } as unknown as LlmResult['content'][number];
}

function result(content: LlmResult['content'], stopReason = 'tool_use'): LlmResult {
  return { model: 'mock-model', content, stopReason, usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0 } };
}

function mockProvider(replies: LlmResult[]): LlmProvider & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    name: 'mock',
    calls,
    async complete(req) {
      calls.push({ ...req, messages: [...req.messages] });
      const next = replies.shift();
      if (!next) throw new Error('unexpected provider call');
      return next;
    },
  };
}

const guard = (intent: string, extra: Record<string, unknown> = {}) =>
  result([toolUse('classify', { intent, rewrittenQuery: 'q', topicSlug: '', language: 'en', ...extra })]);

async function run(role: AuthContext['role'], request: Parameters<typeof runAssistChat>[1]) {
  const events: Array<Record<string, unknown>> = [];
  await runAssistChat(ctx(role), request, (e) => events.push(e as Record<string, unknown>));
  const answer = events.find((e) => e.type === 'answer') as { answer: Record<string, unknown> } | undefined;
  return { events, answer: answer?.answer };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ASSIST_ENABLED = 'true';
  snapshot = {
    companyName: 'Acme India Private Limited',
    legalForm: 'company',
    residency: 'foreign',
    hasForeignParent: true,
    currentPhase: 'SPICe+ Part B',
    currentStep: { id: 'pre-14', title: 'Registered Office Address', owner: 'client', status: 'waiting on you' },
    completedStepCount: 6,
    totalActiveSteps: 40,
    incorporated: false,
  };
  appendAssistMessage.mockImplementation(async () => ({ id: `msg-${appendAssistMessage.mock.calls.length}` }));
  countModelAnswersSince.mockResolvedValue(0);
});

afterEach(() => setAssistProviderForTests(undefined));

describe('role gate', () => {
  it.each(['manager', 'intern'] as const)('rejects %s before any work', async (role) => {
    const provider = mockProvider([]);
    setAssistProviderForTests(provider);
    await expect(run(role, { shell: 'admin', message: 'hi' })).rejects.toBeInstanceOf(AssistForbiddenError);
    expect(provider.calls).toHaveLength(0);
    expect(appendAssistMessage).not.toHaveBeenCalled();
  });
});

describe('deterministic paths', () => {
  it('a suggestion makes zero provider calls', async () => {
    const provider = mockProvider([]);
    setAssistProviderForTests(provider);
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', suggestionId: 'client-gst' });
    expect(provider.calls).toHaveLength(0);
    expect(answer?.topicSlug).toBe('gst-basics');
    // Drafts are never badged reviewed.
    expect(answer?.origin).toBe('generated');
    expect(answer?.draft).toBe(true);
  });

  it('"What is my next step?" shows the real current step', async () => {
    setAssistProviderForTests(mockProvider([]));
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', suggestionId: 'client-next-step' });
    expect(answer?.origin).toBe('deterministic');
    expect(answer?.visual).toMatchObject({ type: 'nextStep', stepId: 'pre-14', title: 'Registered Office Address' });
    expect(answer?.line).toContain('Registered Office Address');
  });

  it('staff queries are answered from tools without the model', async () => {
    const provider = mockProvider([]);
    setAssistProviderForTests(provider);
    loadStaffData.mockResolvedValue({ engagements: [], filings: [], now: new Date() });
    const { answer } = await run('admin', { shell: 'admin', suggestionId: 'admin-waiting-on-client' });
    expect(provider.calls).toHaveLength(0);
    expect(answer?.line).toBe('No projects are waiting on client action.');
    expect(answer?.visual).toMatchObject({ type: 'projectRows' });
  });

  it('super admin preview cannot save or hand off', async () => {
    setAssistProviderForTests(mockProvider([]));
    const { answer } = await run('super_admin', { shell: 'client', engagementId: 'eng-1', suggestionId: 'client-gst' });
    expect(answer?.actions).not.toContain('save');
    expect(answer?.actions).not.toContain('askLead');
  });
});

describe('guarded free text', () => {
  it('off-topic gets the fixed refusal with no generation call', async () => {
    const provider = mockProvider([guard('off_topic')]);
    setAssistProviderForTests(provider);
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', message: 'Write me a Python script' });
    expect(provider.calls).toHaveLength(1);
    expect(answer?.line).toBe(REFUSAL_COPY.offTopicClient);
    expect(answer?.origin).toBe('refusal');
  });

  it('a decision request explains and hands off to the lead', async () => {
    const provider = mockProvider([
      guard('decision_request'),
      result([
        toolUse('render_answer', {
          line: 'GST registration depends on turnover and the kind of supply.',
          citations: [],
          actions: [],
        }),
      ]),
    ]);
    setAssistProviderForTests(provider);
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', message: 'Do we need GST?' });
    expect(provider.calls).toHaveLength(2);
    expect(String(answer?.line)).toMatch(/^This is a decision for your firm\./);
    expect(answer?.actions).toContain('askLead');
    expect(String(answer?.line)).not.toMatch(/\b(yes|no),/i);
  });

  it('retries once on an invented date, then falls back safely', async () => {
    const bad = () =>
      result([toolUse('render_answer', { line: 'It is due on 20 October 2026.', citations: [], actions: [] }, `tu-${Math.random()}`)]);
    const provider = mockProvider([guard('explain'), bad(), bad()]);
    setAssistProviderForTests(provider);
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', message: 'When is GSTR-3B due?' });
    expect(provider.calls).toHaveLength(3);
    expect(answer?.line).toBe(REFUSAL_COPY.uncertain);
    expect(answer?.actions).toContain('askLead');
    // The retry carried the validation error back to the model.
    const retryMessages = provider.calls[2]!.messages;
    expect(JSON.stringify(retryMessages[retryMessages.length - 1])).toContain('does not come from the calendar');
  });

  it('an invalid visual renders as text only', async () => {
    const provider = mockProvider([
      guard('explain'),
      result([
        toolUse('render_answer', {
          line: 'A registered office is the company address for official notices.',
          visual: { type: 'pie', slices: [1, 2] },
          citations: [],
          actions: [],
        }),
      ]),
    ]);
    setAssistProviderForTests(provider);
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', message: 'What is a registered office?' });
    expect(answer?.line).toContain('registered office');
    expect(answer?.visual).toBeUndefined();
    expect(answer?.origin).toBe('generated');
  });

  it('rate limit stops a model call', async () => {
    const provider = mockProvider([]);
    setAssistProviderForTests(provider);
    countModelAnswersSince.mockResolvedValue(999);
    const { events } = await run('client', { shell: 'client', engagementId: 'eng-1', message: 'What is DIN?' });
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'rate_limited' });
    expect(provider.calls).toHaveLength(0);
  });

  it('no provider configured → unavailable answer, suggestions still work', async () => {
    setAssistProviderForTests(null);
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', message: 'What is DIN?' });
    expect(answer?.line).toBe(REFUSAL_COPY.unavailable);
  });

  it('emits progress labels in order', async () => {
    const provider = mockProvider([
      guard('explain'),
      result([toolUse('render_answer', { line: 'DIN is a director number.', citations: [], actions: [] })]),
    ]);
    setAssistProviderForTests(provider);
    const { events } = await run('client', { shell: 'client', engagementId: 'eng-1', message: 'What is DIN?' });
    expect(events.filter((e) => e.type === 'status').map((e) => e.label)).toEqual([
      'Checking your project…',
      'Finding sources…',
      'Writing…',
    ]);
  });
});
