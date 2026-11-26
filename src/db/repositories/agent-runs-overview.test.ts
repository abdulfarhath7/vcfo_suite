import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Scoping of the agent runs overview (Agents today, the control room and Agent results):
 *   super admin and admin — every engagement, no scope lookup;
 *   manager and project lead — only the engagements `listScopedEngagementIds` returns, so a lead
 *   sees only the engagements they lead; with none, no query runs at all;
 *   client, developer and partner — refused before any query;
 *   results and browser usage — firm-wide admins only.
 */

type Call = { op: string; where?: SQL };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    leftJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const call: Call = { op: 'select' };
      calls.push(call);
      return chain(call);
    },
  },
}));

const listScopedEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
}));

const repo = await import('@/db/repositories/agent-runs-overview');
const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const FILTERS = { state: 'all', period: 'week', agent: null, search: '' } as const;

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role, ...(role === 'intern' ? { internId: 'lead-1' } : {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('staff only', () => {
  it.each(['client', 'developer', 'partner'] as const)('%s is refused before any query', async (role) => {
    await expect(repo.listAgentRunsOverview(ctx(role), FILTERS)).rejects.toBeInstanceOf(repo.AgentRunsOverviewForbiddenError);
    await expect(repo.getAgentsTodaySummary(ctx(role))).rejects.toBeInstanceOf(repo.AgentRunsOverviewForbiddenError);
    expect(calls).toHaveLength(0);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });

  it.each(['manager', 'intern'] as const)('%s cannot read the results or the browser usage', async (role) => {
    await expect(repo.getAgentResults(ctx(role), '2026-11', 100)).rejects.toBeInstanceOf(repo.AgentRunsOverviewForbiddenError);
    await expect(repo.browserHoursThisMonth(ctx(role), '2026-11')).rejects.toBeInstanceOf(repo.AgentRunsOverviewForbiddenError);
    expect(calls).toHaveLength(0);
  });
});

describe('scope', () => {
  it.each(['admin', 'super_admin'] as const)('%s reads firm-wide without a scope lookup', async (role) => {
    await repo.listAgentRunsOverview(ctx(role), FILTERS);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toContain('"engagements"."deleted_at" is null');
    expect(q.sql).not.toContain('"live_browser_sessions"."engagement_id" in');
  });

  it.each(['manager', 'intern'] as const)('%s reads only the scoped engagements on every table', async (role) => {
    await repo.listAgentRunsOverview(ctx(role), FILTERS);
    expect(listScopedEngagementIds).toHaveBeenCalledTimes(1);
    const wheres = calls.map((c) => dialect.sqlToQuery(c.where!));
    expect(wheres[0]!.sql).toContain('"live_browser_sessions"."engagement_id" in');
    expect(wheres[1]!.sql).toContain('"assist_agent_runs"."engagement_id" in');
    expect(wheres[2]!.sql).toContain('"gst_return_runs"."engagement_id" in');
    for (const q of wheres) expect(q.params).toContain(OWN);
  });

  it('a lead with no engagements gets an empty list and no query', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    const out = await repo.listAgentRunsOverview(ctx('intern'), FILTERS);
    expect(out).toEqual({ runs: [], agents: [] });
    const summary = await repo.getAgentsTodaySummary(ctx('intern'));
    expect(summary.yourTurn + summary.running + summary.dueIn7).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('the summary reads the compliance occurrences in scope too', async () => {
    await repo.getAgentsTodaySummary(ctx('intern'));
    const due = calls.map((c) => dialect.sqlToQuery(c.where!)).find((q) => q.sql.includes('"compliance_instances"."due_date"'));
    expect(due?.sql).toContain('"compliance_instances"."engagement_id" in');
    expect(due?.params).toContain(OWN);
  });
});
