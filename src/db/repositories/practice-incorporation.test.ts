import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Scoping test for the staff Incorporation read (R-51, D-29). Cross-tenant:
 *   1. A client or a developer is refused before any engagement, profile or compliance read.
 *   2. Every staff role reads through the role-scoped engagement repository with its own
 *      context, and the name and filing reads use only the ids that scope approved. A
 *      manager whose scope holds engagement A never sends engagement B (another team's) or its
 *      lead and manager keys to the database.
 *   3. A row opens in the caller's own shell.
 */

const listEngagements = vi.fn();
const listChecklistIndex = vi.fn();
const dbSelect = vi.fn();
const inArrayCalls: unknown[][] = [];

vi.mock('server-only', () => ({}));
vi.mock('@/db/client', () => ({ db: { select: (...args: unknown[]) => dbSelect(...args) } }));
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    inArray: (column: unknown, values: unknown[]) => {
      inArrayCalls.push(values);
      return actual.inArray(column as never, values as never);
    },
  };
});
vi.mock('@/db/repositories/engagements', () => ({
  listEngagements: (...args: unknown[]) => listEngagements(...args),
  listChecklistIndex: (...args: unknown[]) => listChecklistIndex(...args),
}));

const { listPracticeIncorporation } = await import('@/db/repositories/practice-incorporation');

const ENGAGEMENT_A = '33333333-3333-3333-3333-333333333303';
const ENGAGEMENT_B = '22222222-2222-2222-2222-222222222202';

const ctx = (role: AuthContext['role'], userId = `user-${role}`): AuthContext => ({
  userId,
  email: `${role}@vcfo.local`,
  name: role,
  role,
});

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: id === ENGAGEMENT_A ? 'acme-india' : 'globex-india',
    companyName: id === ENGAGEMENT_A ? 'Acme India Private Limited' : 'Globex India Private Limited',
    clientName: null,
    internId: id === ENGAGEMENT_A ? 'lead-a' : 'lead-b',
    managerId: id === ENGAGEMENT_A ? 'user-manager' : 'manager-b',
    adminId: null,
    stage: 'Pre-Incorporation',
    health: 'on-track',
    incorporationDate: null,
    schedule: null,
    createdAt: new Date('2026-01-05T00:00:00.000Z'),
    updatedAt: new Date('2026-01-05T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function stubSelect(rows: unknown[] = []) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(rows),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

/** The firm: engagement A (manager's team) and B (another team). Each role sees its slice. */
function scopeByRole(c: AuthContext) {
  if (c.role === 'admin' || c.role === 'super_admin') return [row(ENGAGEMENT_A), row(ENGAGEMENT_B)];
  if (c.role === 'manager' && c.userId === 'user-manager') return [row(ENGAGEMENT_A)];
  if (c.role === 'intern' && c.userId === 'user-lead-a') return [row(ENGAGEMENT_A)];
  return [];
}

beforeEach(() => {
  vi.clearAllMocks();
  inArrayCalls.length = 0;
  listEngagements.mockImplementation(async (c: AuthContext) => scopeByRole(c));
  listChecklistIndex.mockResolvedValue({});
  dbSelect.mockImplementation(() =>
    stubSelect([
      { id: 'user-manager', internId: null, name: 'Meera Manager', email: 'pm@vcfo.local' },
      { id: 'p-lead-a', internId: 'lead-a', name: 'Lata Lead', email: 'lead@vcfo.local' },
    ]),
  );
});

describe('listPracticeIncorporation — cross-tenant scoping', () => {
  it.each(['client', 'developer'] as const)('refuses a %s before any read', async (role) => {
    await expect(listPracticeIncorporation(ctx(role))).rejects.toThrow(/staff/);
    expect(listEngagements).not.toHaveBeenCalled();
    expect(listChecklistIndex).not.toHaveBeenCalled();
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it("a manager reads only their team's engagement; the other team's ids and keys never reach the database", async () => {
    const manager = ctx('manager');
    const clients = await listPracticeIncorporation(manager);
    expect(listEngagements).toHaveBeenCalledWith(manager);
    expect(listChecklistIndex).toHaveBeenCalledWith(manager);
    expect(clients.map((c) => c.summary.companyName)).toEqual(['Acme India Private Limited']);
    const sent = inArrayCalls.flat();
    expect(sent).not.toContain(ENGAGEMENT_B);
    expect(sent).not.toContain('lead-b');
    expect(sent).not.toContain('manager-b');
    expect(sent).toContain(ENGAGEMENT_A);
  });

  it("a lead reads only their own client and gets nothing from another lead's", async () => {
    const mine = await listPracticeIncorporation(ctx('intern', 'user-lead-a'));
    expect(mine.map((c) => c.summary.id)).toEqual([ENGAGEMENT_A]);
    expect(mine[0].summary.leadName).toBe('Lata Lead');
    expect(mine[0].summary.managerName).toBe('Meera Manager');

    vi.clearAllMocks();
    const other = await listPracticeIncorporation(ctx('intern', 'user-lead-z'));
    expect(other).toEqual([]);
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it.each(['admin', 'super_admin'] as const)('a firm-wide %s reads every client', async (role) => {
    const clients = await listPracticeIncorporation(ctx(role));
    expect(clients.map((c) => c.summary.id).sort()).toEqual([ENGAGEMENT_A, ENGAGEMENT_B].sort());
  });

  it("opens each row in the caller's own shell", async () => {
    const [lead] = await listPracticeIncorporation(ctx('intern', 'user-lead-a'));
    expect(lead.summary.href).toBe('/app/intern/engagements/acme-india');
    const [mgr] = await listPracticeIncorporation(ctx('manager'));
    expect(mgr.summary.href).toBe('/app/manager/projects/acme-india');
    const admin = await listPracticeIncorporation(ctx('admin'));
    expect(admin.map((c) => c.summary.href).sort()).toEqual(['/app/admin/projects/acme-india', '/app/admin/projects/globex-india']);
  });

  it('marks a client with a certificate date as incorporated', async () => {
    listEngagements.mockResolvedValueOnce([row(ENGAGEMENT_A, { incorporationDate: '2026-03-01', stage: 'Post-Incorporation' })]);
    const [c] = await listPracticeIncorporation(ctx('admin'));
    expect(c.summary.incorporated).toBe(true);
    expect(c.certificateDate).toBe('2026-03-01');
  });
});
