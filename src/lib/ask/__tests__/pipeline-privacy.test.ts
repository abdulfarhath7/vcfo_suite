import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { ProjectSnapshot } from '@/data/ask/schema';
import type { LlmProvider, LlmRequest, LlmResult } from '@/lib/ask/provider';

/**
 * Privacy at the provider seam (docs/specs/ask-vcfo/PRIVACY.md): the stub provider records exactly
 * what would leave the app, and no PAN, Aadhaar, email, phone or known name may be in it. The
 * answer the person sees still carries their own values.
 */

const appendAskMessage = vi.fn();
const countModelAnswersSince = vi.fn();
const loadStaffData = vi.fn();
let snapshot: ProjectSnapshot;

vi.mock('@/db/repositories/ask-conversations', () => ({
  createAskConversation: (...a: unknown[]) => createAskConversation(...a),
  getAskConversationWithMessages: (...a: unknown[]) => getAskConversationWithMessages(...a),
}));
vi.mock('@/db/repositories/ask-messages', () => ({
  appendAskMessage: (...a: unknown[]) => appendAskMessage(...a),
  countModelAnswersSince: (...a: unknown[]) => countModelAnswersSince(...a),
}));
const getAskConversationWithMessages = vi.fn();
const systemRecordAskUsage = vi.fn();
const systemTodayTokenTotal = vi.fn();
vi.mock('@/db/repositories/ask-runs', () => ({ findWaitingAskRun: vi.fn(async () => null) }));
vi.mock('@/db/repositories/ask-usage', () => ({
  systemRecordAskUsage: (...a: unknown[]) => systemRecordAskUsage(...a),
  systemTodayTokenTotal: (...a: unknown[]) => systemTodayTokenTotal(...a),
}));
const loadProjectSnapshot = vi.fn();
const createAskConversation = vi.fn();
vi.mock('@/lib/ask/snapshot', () => ({
  loadProjectSnapshot: (...a: unknown[]) => loadProjectSnapshot(...a),
}));
const defaultSnapshotLoad = () => ({
    snapshot,
    engagementDbId: 'eng-db-1',
    engagementSlug: 'acme',
    state: {},
    filings: [],
});
vi.mock('@/db/repositories/ask-saved-answers', () => ({ findSavedAnswer: vi.fn(async () => null), saveAnswer: vi.fn(async () => undefined) }));
vi.mock('@/lib/ask/knowledge-version', () => ({ currentKnowledgeVersion: vi.fn(async () => 'kv') }));
const retrieveSources = vi.fn(async (..._a: unknown[]) => []);
vi.mock('@/lib/ask/retrieve', () => ({ retrieveSources: (...a: unknown[]) => retrieveSources(...a) }));
vi.mock('@/lib/ask/tools/staff-data', () => ({
  loadStaffData: (...a: unknown[]) => loadStaffData(...a),
  loadStaffEngagements: vi.fn(async () => []),
}));

const { runAskChat } = await import('@/lib/ask/pipeline');
const { setAskProviderForTests } = await import('@/lib/ask/provider');

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@x.test`, name: role, role };
}

function toolUse(name: string, input: unknown, id = `tu-${name}`) {
  return { type: 'tool_use', id, name, input } as unknown as LlmResult['content'][number];
}

function result(content: LlmResult['content'], stopReason = 'tool_use'): LlmResult {
  return { model: 'mock-model', content, stopReason, usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 } };
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
  result(
    [{ type: 'text', text: JSON.stringify({ intent, rewrittenQuery: 'q', topicSlug: '', language: 'en', ...extra }) } as unknown as LlmResult['content'][number]],
    'end_turn',
  );

async function run(role: AuthContext['role'], request: Parameters<typeof runAskChat>[1], name?: string) {
  const events: Array<Record<string, unknown>> = [];
  await runAskChat({ ...ctx(role), ...(name ? { name } : {}) }, request, (e) => events.push(e as Record<string, unknown>));
  const answer = events.find((e) => e.type === 'answer') as { answer: Record<string, unknown> } | undefined;
  return { events, answer: answer?.answer };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ASK_VCFO_ENABLED = 'true';
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
  appendAskMessage.mockImplementation(async () => ({ id: `msg-${appendAskMessage.mock.calls.length}` }));
  countModelAnswersSince.mockResolvedValue(0);
  getAskConversationWithMessages.mockResolvedValue(null);
  loadStaffData.mockResolvedValue({ engagements: [], filings: [], now: new Date() });
  systemRecordAskUsage.mockResolvedValue(undefined);
  systemTodayTokenTotal.mockResolvedValue(0);
  loadProjectSnapshot.mockImplementation(async () => defaultSnapshotLoad());
  createAskConversation.mockResolvedValue({ id: 'conv-1' });
});

afterEach(() => {
  setAskProviderForTests(undefined);
  vi.unstubAllEnvs();
});


const SECRETS = ['ABCDE1234F', '2345 6789 0123', '234567890123', 'asha.rao@example.com', '98765 43210', '9876543210'];
const MESSAGE = 'I am Ravi Menon. My PAN is ABCDE1234F, Aadhaar 2345 6789 0123, email asha.rao@example.com, mobile +91 98765 43210. Which forms need these?';

function expectNothingSecret(calls: unknown[], extra: string[] = []) {
  const sent = JSON.stringify(calls);
  for (const secret of [...SECRETS, ...extra]) expect(sent).not.toContain(secret);
}

describe('answer path privacy', () => {
  it('a client answer: no PAN, Aadhaar, email, phone or name reaches the provider, and the answer is restored', async () => {
    const provider = mockProvider([
      guard('explain', { rewrittenQuery: 'Which forms need the PAN, Aadhaar, [EMAIL_1] and [PHONE_1] of [CLIENT_1]?' }),
      result([toolUse('render_answer', { line: 'SPICe+ uses [EMAIL_1] and [PHONE_1] for [CLIENT_1]; the PAN shows as XXXXXX234F.', citations: [], actions: [] })]),
    ]);
    setAskProviderForTests(provider);
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', message: MESSAGE }, 'Ravi Menon');
    expect(provider.calls).toHaveLength(2);
    // The client's own name is known from the engagement, so it is masked too.
    expectNothingSecret(provider.calls, ['Ravi Menon']);
    expect(JSON.stringify(provider.calls)).toContain('[EMAIL_1]');
    expect(answer?.line).toBe('SPICe+ uses asha.rao@example.com and +91 98765 43210 for Ravi Menon; the PAN shows as XXXXXX234F.');
    // The embedding search leaves the app too, so it gets the masked words.
    expect(JSON.stringify(retrieveSources.mock.calls)).not.toContain('asha.rao@example.com');
  });

  it('a staff answer with history: earlier answers are masked again before they go back out', async () => {
    getAskConversationWithMessages.mockResolvedValue({
      conversation: { id: '11111111-1111-4111-8111-111111111111', shell: 'admin', engagementId: null },
      messages: [
        { sender: 'user', text: 'What is the email for the director?' },
        { sender: 'assistant', text: 'It is asha.rao@example.com and the phone is 9876543210.' },
      ],
    });
    const provider = mockProvider([
      guard('explain'),
      result([toolUse('render_answer', { line: 'Use [EMAIL_1] for the DIR-3 KYC.', citations: [], actions: [] })]),
    ]);
    setAskProviderForTests(provider);
    const { answer } = await run('admin', { shell: 'admin', conversationId: '11111111-1111-4111-8111-111111111111', message: MESSAGE });
    // A free-text name staff type is not known to the engagement, so it is out of scope (PRIVACY.md).
    expectNothingSecret(provider.calls);
    expect(answer?.line).toBe('Use asha.rao@example.com for the DIR-3 KYC.');
  });

  it('with ASK_CLIENT_DATA_ENABLED=false the model gets no snapshot, tools or history, and the person is told', async () => {
    vi.stubEnv('ASK_CLIENT_DATA_ENABLED', 'false');
    const provider = mockProvider([guard('project_status'), result([toolUse('render_answer', { line: 'Companies usually file INC-20A after incorporation.', citations: [], actions: [] })])]);
    setAskProviderForTests(provider);
    const { answer } = await run('client', { shell: 'client', engagementId: 'eng-1', message: 'Where is my project?' });
    const generate = provider.calls[1]!;
    expect(JSON.stringify(generate.system)).not.toContain('Acme India Private Limited');
    expect(generate.tools?.map((t) => t.name)).toEqual(['render_answer']);
    expect(retrieveSources.mock.calls[0]![1]).toMatchObject({ includeCards: false, engagementId: null });
    expect(String(answer?.line)).toMatch(/^This answer uses general knowledge only\./);
  });
});
