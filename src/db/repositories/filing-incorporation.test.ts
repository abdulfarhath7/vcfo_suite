import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

/**
 * The register read (`getFilings`, behind the Work timeline, calendars and filings lists) adds
 * the incorporation guard beside the caller's scope, so a filing of a company that is not
 * incorporated, or dated before its incorporation, never reaches a screen.
 */

let captured: SQL | undefined;
const chain: Record<string, unknown> = {
  from: () => chain,
  innerJoin: () => chain,
  where: (w: SQL) => ((captured = w), chain),
  orderBy: () => Promise.resolve([]),
};

vi.mock('server-only', () => ({}));
vi.mock('@/db/client', () => ({ db: { select: () => chain } }));
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: async () => ['11111111-1111-4111-8111-111111111111'],
  assertEngagementAccess: async () => ({ ok: false }),
}));

const { getFilings } = await import('@/db/repositories/filings');
const { filingAfterIncorporation } = await import('@/db/repositories/filing-incorporation');

const dialect = new PgDialect();
const render = (q: SQL) => dialect.sqlToQuery(q).sql.replace(/\s+/g, ' ');

describe('filings only after incorporation', () => {
  it('needs an incorporation date on or before the filing, or a Registration start', () => {
    const text = render(filingAfterIncorporation);
    expect(text).toContain('inc_e.id = "compliance_instances"."engagement_id"');
    expect(text).toContain('"compliance_instances"."due_date" >= inc_e.incorporation_date');
    expect(text).toContain('"compliance_instances"."period_end" >= inc_e.incorporation_date');
    expect(text).toContain("else inc_e.stage <> 'Pre-Incorporation'");
  });

  it('is applied by the register read beside the scope', async () => {
    await getFilings({ userId: 'u1', role: 'manager' } as never);
    expect(captured).toBeDefined();
    const text = render(captured!);
    expect(text).toContain('"compliance_instances"."engagement_id" in');
    expect(text).toContain('inc_e.incorporation_date');
  });
});
