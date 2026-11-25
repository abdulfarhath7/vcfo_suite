import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { LlmProvider } from '@/lib/ask/provider';

/**
 * "Register Kestrel for GST" in Ask VCFO: answered by code from the GST profile, no model call,
 * staff only, with the GST card and the step link; the client shell never takes this branch.
 */

const appendAskMessage = vi.fn();
const countModelAnswersSince = vi.fn();
const systemTodayTokenTotal = vi.fn();
const systemRecordAskUsage = vi.fn();
const loadStaffEngagements = vi.fn();
const loadProjectSnapshot = vi.fn();
const listEngagements = vi.fn();

vi.mock('@/db/repositories/ask-conversations', () => ({
  createAskConversation: vi.fn(async () => ({ id: 'conv-1' })),
  getAskConversationWithMessages: vi.fn(async () => null),
}));
vi.mock('@/db/repositories/ask-messages', () => ({
  appendAskMessage: (...a: unknown[]) => appendAskMessage(...a),
  countModelAnswersSince: (...a: unknown[]) => countModelAnswersSince(...a),
}));
vi.mock('@/db/repositories/ask-runs', () => ({ findWaitingAskRun: vi.fn(async () => null), findRecentAskDropRun: vi.fn(async () => null) }));
vi.mock('@/db/repositories/ask-usage', () => ({
  systemRecordAskUsage: (...a: unknown[]) => systemRecordAskUsage(...a),
  systemTodayTokenTotal: (...a: unknown[]) => systemTodayTokenTotal(...a),
}));
vi.mock('@/lib/ask/snapshot', () => ({ loadProjectSnapshot: (...a: unknown[]) => loadProjectSnapshot(...a) }));
vi.mock('@/db/repositories/ask-saved-answers', () => ({ findSavedAnswer: vi.fn(async () => null), saveAnswer: vi.fn(async () => undefined) }));
vi.mock('@/lib/ask/knowledge-version', () => ({ currentKnowledgeVersion: vi.fn(async () => 'kv') }));
vi.mock('@/lib/ask/retrieve', () => ({ retrieveSources: vi.fn(async () => []) }));
vi.mock('@/lib/ask/tools/staff-data', () => ({
  loadStaffData: vi.fn(async () => ({ engagements: [{ engagement: { id: 'd', slug: 'delta' } }], filings: [], now: new Date() })),
  loadStaffEngagements: (...a: unknown[]) => loadStaffEngagements(...a),
}));
vi.mock('@/db/repositories/engagements', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/repositories/engagements')>()),
  listEngagements: (...a: unknown[]) => listEngagements(...a),
}));

const gstWorkAnswer = vi.fn();
vi.mock('@/lib/ask/gst/answer', () => ({ gstWorkAnswer: (...a: unknown[]) => gstWorkAnswer(...a) }));

const { runAskChat } = await import('@/lib/ask/pipeline');
const { setAskProviderForTests } = await import('@/lib/ask/provider');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `user-${role}`, email: `${role}@x.test`, name: role, role });
const CARD = { engagementId: 'd', projectKey: 'delta', companyName: 'Delta Pvt Ltd', ready: false, gaps: [], gapCount: 3, actions: ['fetch_sharepoint', 'ask_client', 'open_step'] };

function failingProvider() {
  const provider: LlmProvider = {
    name: 'mock',
    complete: vi.fn(async () => {
      throw new Error('the provider must not be called');
    }),
  };
  return provider;
}

async function chat(role: AuthContext['role'], message: string, shell: 'client' | 'admin' = 'admin') {
  const events: Array<Record<string, unknown>> = [];
  await runAskChat(ctx(role), { shell, message, depth: 'normal', ...(shell === 'client' ? { engagementId: 'b' } : {}), page: { path: '/app/lead/projects/delta' } } as never, (e) => events.push(e as Record<string, unknown>));
  const event = events.find((e) => e.type === 'answer') as { answer: Record<string, unknown> & { gst?: unknown; runId?: string; line?: string; links?: Array<Record<string, unknown>> } } | undefined;
  const stored = appendAskMessage.mock.calls.map((c) => c[2]).find((m) => m.sender === 'assistant');
  return { answer: event?.answer, path: stored?.path as string | undefined, model: stored?.model };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ASK_VCFO_ENABLED = 'true';
  appendAskMessage.mockImplementation(async () => ({ id: 'msg-1' }));
  countModelAnswersSince.mockResolvedValue(0);
  systemTodayTokenTotal.mockResolvedValue(0);
  loadStaffEngagements.mockResolvedValue([]);
  listEngagements.mockResolvedValue([{ id: 'd', slug: 'delta', companyName: 'Delta Pvt Ltd' }]);
  loadProjectSnapshot.mockResolvedValue({
    snapshot: { companyName: 'Beta Pvt Ltd', legalForm: 'company', residency: 'domestic', hasForeignParent: false, currentPhase: 'x', completedStepCount: 1, totalActiveSteps: 2, incorporated: true },
    engagementDbId: 'b',
    engagementSlug: 'b',
    state: {},
    filings: [],
  });
  gstWorkAnswer.mockResolvedValue({ line: 'Delta Pvt Ltd is not ready for GST registration yet.', target: { engagementId: 'delta', stepId: 'reg-4' }, gst: CARD });
  setAskProviderForTests(failingProvider());
});

afterEach(() => {
  setAskProviderForTests(undefined);
});

describe('GST registration in Ask VCFO', () => {
  it('answers a lead by code with the card and the step link, no model', async () => {
    const out = await chat('intern', 'register Delta for GST');
    expect(gstWorkAnswer).toHaveBeenCalledWith(expect.objectContaining({ role: 'intern' }), { kind: 'readiness', company: 'delta' }, { conversationId: 'conv-1', pagePath: '/app/lead/projects/delta' });
    expect(out.answer?.gst).toEqual(CARD);
    expect(out.answer?.links?.[0]).toMatchObject({ dest: { to: 'projectStep', engagementId: 'delta', stepId: 'reg-4' } });
    expect(out.path).toBe('fixed_workflow');
    expect(out.model ?? null).toBeNull();
  });

  it('carries a SharePoint run so the chat polls the drop', async () => {
    gstWorkAnswer.mockResolvedValue({ line: 'Reading the SharePoint folder.', runId: '00000000-0000-4000-8000-000000000001' });
    const out = await chat('manager', 'Fetch the GST registration papers for Delta from SharePoint');
    expect(gstWorkAnswer.mock.calls[0]![1]).toEqual({ kind: 'fetch_sharepoint', company: 'delta' });
    expect(out.answer?.runId).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('says nothing was changed when the work fails', async () => {
    gstWorkAnswer.mockRejectedValue(new Error('db down'));
    const out = await chat('intern', 'do GST registration for Delta');
    expect(out.answer?.line).toMatch(/Nothing was changed/);
  });

  it('never runs in the client shell', async () => {
    await chat('client', 'register Beta for GST', 'client');
    expect(gstWorkAnswer).not.toHaveBeenCalled();
  });
});
