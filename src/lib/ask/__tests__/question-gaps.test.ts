import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { topicSchema } from '@/data/ask/schema';
import { draftTopicFor, groupQuestions, type GapQuestion } from '@/lib/ask/question-gaps';

let generatedRows: unknown[] = [];
let handoffRows: unknown[] = [];
const dbSelect = vi.fn();
vi.mock('@/db/client', () => ({ db: { select: (...a: unknown[]) => dbSelect(...a) } }));

const requireAsk = vi.fn();
vi.mock('@/lib/ask/route-guard', () => ({ requireAsk: () => requireAsk() }));

const { listClientQuestionsForGaps } = await import('@/db/repositories/ask-question-gaps');
const { AskForbiddenError } = await import('@/lib/ask/access');
const { GET } = await import('../../../../app/api/ask/admin/gaps/route');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: 'x@x.test', name: role, role });
const since = new Date('2026-09-01T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  generatedRows = [
    { question: 'Do we need a company secretary?', askedAt: new Date('2026-09-20T10:00:00Z'), companyName: 'Acme India Private Limited' },
    { question: '  ', askedAt: new Date('2026-09-21T10:00:00Z'), companyName: 'Acme India Private Limited' },
  ];
  handoffRows = [
    {
      description: 'Can the parent pay share capital in USD?\n— Ask VCFO context —\nClient: …\nAsk VCFO conversation: abc',
      askedAt: new Date('2026-09-22T10:00:00Z'),
      companyName: 'Bharat Widgets Private Limited',
    },
  ];
  let call = 0;
  dbSelect.mockImplementation(() => {
    const rows = call === 0 ? generatedRows : handoffRows;
    call += 1;
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(rows),
    };
    return chain;
  });
  delete process.env.ASK_VCFO_FEATURE_A1;
});

describe('A1 repository scope', () => {
  it('hides client identity from a firm admin', async () => {
    const rows = await listClientQuestionsForGaps(ctx('admin'), since);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.companyName === null)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('Acme');
    expect(JSON.stringify(rows)).not.toContain('Bharat');
  });

  it('shows company names to a super admin only', async () => {
    const rows = await listClientQuestionsForGaps(ctx('super_admin'), since);
    expect(rows.map((r) => r.companyName)).toEqual(['Acme India Private Limited', 'Bharat Widgets Private Limited']);
  });

  it('keeps only the question from a hand-off, not the transcript', async () => {
    const rows = await listClientQuestionsForGaps(ctx('admin'), since);
    expect(rows.find((r) => r.source === 'handoff')?.question).toBe('Can the parent pay share capital in USD?');
  });

  it.each(['client', 'manager', 'intern'] as const)('refuses %s before any query', async (role) => {
    await expect(listClientQuestionsForGaps(ctx(role), since)).rejects.toBeInstanceOf(AskForbiddenError);
    expect(dbSelect).not.toHaveBeenCalled();
  });
});

describe('A1 route', () => {
  it('is 404 while the flag is off and 403 for a client when on', async () => {
    requireAsk.mockResolvedValue({ ok: true, ctx: ctx('admin') });
    expect((await GET()).status).toBe(404);
    process.env.ASK_VCFO_FEATURE_A1 = 'true';
    requireAsk.mockResolvedValue({ ok: true, ctx: ctx('client') });
    expect((await GET()).status).toBe(403);
    requireAsk.mockResolvedValue({ ok: true, ctx: ctx('admin') });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { showsCompanies: boolean; groups: Array<{ companies: string[] }> };
    expect(body.showsCompanies).toBe(false);
    expect(body.groups.every((g) => g.companies.length === 0)).toBe(true);
  });
});

describe('grouping', () => {
  const q = (question: string, askedAt: string, source: GapQuestion['source'] = 'generated'): GapQuestion => ({
    question,
    askedAt,
    source,
    companyName: null,
  });

  it('groups similar questions and ranks by how often they were asked', () => {
    const groups = groupQuestions([
      q('Do we need a company secretary?', '2026-09-20T00:00:00Z'),
      q('Is a company secretary needed for us?', '2026-09-22T00:00:00Z'),
      q('Does the company need a secretary', '2026-09-21T00:00:00Z', 'handoff'),
      q('Can the parent pay share capital in USD?', '2026-09-23T00:00:00Z'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ count: 3, generated: 2, handoffs: 1, question: 'Is a company secretary needed for us?' });
    expect(groups[1]?.count).toBe(1);
  });

  it('builds a draft topic file that passes the topic schema', () => {
    const topic = draftTopicFor('Do we need a company secretary?');
    expect(topicSchema.safeParse(topic).success).toBe(true);
    expect(topic).toMatchObject({ slug: 'do-we-need-a-company-secretary', status: 'draft' });
  });
});
