import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { AuditEventRow } from '@/lib/audit/audit-log';

/**
 * GL-07 sent emails: staff read the `email.sent` records of a project in their scope; a client
 * reads only their own project and only the emails sent to them, with the sender's first name.
 */

let dbRows: unknown[] = [];
const selectCalls: unknown[] = [];

function chain(): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    where: (w: unknown) => {
      selectCalls.push(w);
      return c;
    },
    orderBy: () => c,
    limit: () => c,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(dbRows).then(res, rej),
  };
  return c;
}

vi.mock('@/db/client', () => ({ db: { select: () => chain() } }));

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));

const listAuditEvents = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  listAuditEvents: (...a: unknown[]) => listAuditEvents(...a),
  toAuditEventRow: (r: AuditEventRow) => r,
}));

const { listSentEmails } = await import('@/db/repositories/sent-emails');

function ctx(role: AuthContext['role'], email = `${role}@vcfo.local`): AuthContext {
  return { userId: `user-${role}`, email, name: role, role };
}

function audit(over: Partial<AuditEventRow> & { metadata: Record<string, unknown> }): AuditEventRow {
  return {
    id: 'a',
    created_at: '2026-11-12T09:30:00.000Z',
    actor_user_id: 'u1',
    actor_role: 'intern',
    actor_email: 'asha@sbc.example',
    actor_name: 'Asha Rao',
    engagement_id: 'e1',
    action: 'email.sent',
    summary: '',
    result: 'ok',
    ...over,
  } as AuditEventRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbRows = [];
  selectCalls.length = 0;
});

describe('listSentEmails', () => {
  it.each(['admin', 'super_admin', 'manager', 'intern'] as const)('%s reads through the scoped audit list', async (role) => {
    listAuditEvents.mockResolvedValue([
      audit({ metadata: { to: ['c@acme.in'], subject: 'One', itemId: 'pre-15' } }),
      audit({ metadata: { to: ['c@acme.in'], subject: 'Two', itemId: 'pre-4' } }),
    ]);
    const rows = await listSentEmails(ctx(role), { engagementId: 'e1', itemId: 'pre-15' });
    expect(listAuditEvents).toHaveBeenCalledWith(expect.objectContaining({ role }), expect.objectContaining({ engagementId: 'e1', action: 'email.sent' }));
    expect(rows).toEqual([expect.objectContaining({ by: 'Asha Rao', subject: 'One', itemId: 'pre-15' })]);
    expect(selectCalls).toHaveLength(0);
  });

  it('a client outside the project gets nothing and no query', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: 'e2', forbidden: true });
    expect(await listSentEmails(ctx('client'), { engagementId: 'e2' })).toEqual([]);
    expect(selectCalls).toHaveLength(0);
    expect(listAuditEvents).not.toHaveBeenCalled();
  });

  it('a client reads only the emails sent to them, with the first name or "Admin"', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: 'e1', row: {} });
    dbRows = [
      audit({ metadata: { to: ['Me@Acme.in'], subject: 'To me', itemId: 'pre-15' } }),
      audit({ actor_role: 'admin', actor_name: 'Priya Iyer', metadata: { to: ['x@acme.in'], cc: ['me@acme.in'], subject: 'Cc me', itemId: 'pre-15' } }),
      audit({ metadata: { to: ['someone-else@acme.in'], subject: 'Not mine', itemId: 'pre-15' } }),
    ];
    const rows = await listSentEmails(ctx('client', 'me@acme.in'), { engagementId: 'e1' });
    expect(rows.map((r) => [r.by, r.subject])).toEqual([
      ['Asha', 'To me'],
      ['Admin', 'Cc me'],
    ]);
    expect(JSON.stringify(rows)).not.toContain('asha@sbc.example');
  });

  it('any other role gets nothing', async () => {
    expect(await listSentEmails(ctx('developer' as AuthContext['role']), { engagementId: 'e1' })).toEqual([]);
    expect(listAuditEvents).not.toHaveBeenCalled();
    expect(selectCalls).toHaveLength(0);
  });
});
