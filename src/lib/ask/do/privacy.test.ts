import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { LlmRequest } from '@/lib/ask/provider';
import { getActiveCatalogItems } from '@/data/checklist';

/**
 * Privacy in the Do path (docs/specs/ask-vcfo/PRIVACY.md): the stub provider records what would
 * leave the app. No PAN, Aadhaar, email or phone may be in it, and every value on the card comes
 * from the person's own text on the server, never from the model's reply alone.
 */

const lead: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern' };

const stateAtPre15 = () => {
  const state: Record<string, unknown> = {};
  for (const item of getActiveCatalogItems()) {
    if (item.id === 'pre-15') break;
    state[item.id] = { status: 'completed', reviewStatus: 'accepted', responses: {} };
  }
  return state;
};
const acme = { id: 'a0000000-0000-4000-8000-00000000000a', slug: 'acme', companyName: 'Acme Robotics Private Limited', parentEntityName: null, ownershipType: 'indian' };
const kestrel = { id: 'b0000000-0000-4000-8000-00000000000b', slug: 'kestrel', companyName: 'Kestrel Robotics Pvt Ltd', parentEntityName: null, ownershipType: 'indian' };

let engagements = [acme, kestrel];
const patchChecklist = vi.fn();
const createChangeset = vi.fn(async (_ctx: unknown, _input: { draft: { engagementId: string; rows: Array<Record<string, unknown>> }; contentHash: string }) => 'd0000000-0000-4000-8000-00000000000d');
const updateRun = vi.fn();
const createRun = vi.fn(async () => ({ id: 'run-1' }));
const waiting = vi.fn(async () => null as unknown);
const lockRun = vi.fn(async () => true);
const attachments = vi.fn(async () => [] as unknown[]);
const updateAttachment = vi.fn();
const createAttachment = vi.fn(async () => ({ id: 'paste-1' }));
const putObject = vi.fn();
const getObject = vi.fn(async () => null as Buffer | null);

vi.mock('@/db/repositories/engagements', () => ({
  listEngagements: async () => engagements,
  getEngagementById: async (_ctx: unknown, id: string) => engagements.find((e) => e.id === id) ?? null,
  getEngagementBySlug: async (_ctx: unknown, slug: string) => engagements.find((e) => e.slug === slug) ?? null,
  checklistStateFromRow: () => stateAtPre15(),
  patchChecklistItem: (...a: unknown[]) => patchChecklist(...a),
}));
vi.mock('@/db/repositories/ask-changesets', () => ({ createAskChangeset: createChangeset }));
vi.mock('@/db/repositories/ask-runs', () => ({ createAskRun: createRun, updateAskRun: (...a: unknown[]) => updateRun(...a), findWaitingAskRun: waiting, lockAskRun: lockRun, appendAskRunStep: vi.fn() }));
vi.mock('@/db/repositories/ask-attachments', () => ({ getOwnAskAttachments: attachments, updateOwnAskAttachment: updateAttachment, createAskAttachment: createAttachment }));
vi.mock('@/db/repositories/ask-usage', () => ({ systemTodayTokenTotal: async () => 0 }));
vi.mock('@/db/repositories/notifications', () => ({ createNotificationsForUsers: vi.fn(async () => []) }));
vi.mock('@/db/repositories/engagement-managers-membership', () => ({ listManagerIdsForEngagement: async () => ['mgr-1'] }));
vi.mock('@/lib/ask/rate-limit', () => ({ checkAskRateLimit: async () => ({ ok: true }) }));
vi.mock('@/storage/s3', () => ({ putObject: (...a: unknown[]) => putObject(...a), getObjectBuffer: () => getObject() }));
const modelCalls: LlmRequest[] = [];
let replyValues: Array<Record<string, unknown>> = [];
vi.mock('@/lib/ask/provider', async (load) => ({
  ...(await load<object>()),
  getAskProvider: async () => ({
    name: 'mock',
    complete: async (req: LlmRequest) => {
      modelCalls.push(JSON.parse(JSON.stringify(req)));
      return { model: req.model, content: [{ type: 'text', text: JSON.stringify({ docType: 'other', company: null, values: replyValues, picks: [] }) }], stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
    },
  }),
}));

const { handleDoWork } = await import('./entry');

const run = (message: string) =>
  handleDoWork(lead, { shell: 'admin' }, message, () => undefined, {
    conversationId: 'e0000000-0000-4000-8000-00000000000e',
    now: new Date('2026-11-06T10:00:00Z'),
    pending: null,
  });

const PROSE = [
  'Please add the new director for Acme',
  'Her name is Asha Rao and her email is asha.rao@example.com, mobile 98765 43210',
  'Her PAN is ABCDE1234F and her Aadhaar is 2345 6789 0123',
  'Thanks a lot',
].join('\n');

const value = (label: string, v: string) => ({ label, value: v, page: null, person: 'Asha Rao', confidence: 0.9 });

beforeEach(() => {
  vi.clearAllMocks();
  modelCalls.length = 0;
  engagements = [acme, kestrel];
  waiting.mockResolvedValue(null);
  attachments.mockResolvedValue([]);
  replyValues = [];
});

describe('Do path privacy', () => {
  it('sends no PAN, Aadhaar, email or phone to the model, and files only values from the original text', async () => {
    replyValues = [
      value('Email', '[EMAIL_1]'),
      value('Mobile', '[PHONE_1]'),
      value('PAN', 'IDTOKEN1X'),
      // A value the model made up is not in the text, so it never reaches the card.
      value('Email', '[EMAIL_7]'),
      value('Email', 'invented@example.com'),
    ];
    const result = await run(PROSE);
    expect(modelCalls.length).toBeGreaterThan(0);
    const sent = JSON.stringify(modelCalls);
    for (const secret of ['ABCDE1234F', '2345 6789 0123', 'asha.rao@example.com', '98765 43210', '9876543210']) expect(sent).not.toContain(secret);
    expect(result).toBeTruthy();
    const rows = JSON.stringify(createChangeset.mock.calls.map((call) => call[1].draft.rows));
    expect(rows).not.toMatch(/\[(?:EMAIL|PHONE)_\d+\]|IDTOKEN|invented@example\.com/);
    expect(rows).toContain('asha.rao@example.com');
  });

  it('with ASK_CLIENT_DATA_ENABLED=false makes no model call and says so', async () => {
    vi.stubEnv('ASK_CLIENT_DATA_ENABLED', 'false');
    try {
      const result = await run(PROSE);
      expect(modelCalls).toHaveLength(0);
      expect(result!.answer.line).toMatch(/switched off/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
