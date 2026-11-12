import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import { summarizeEngagement } from '@/lib/super/super-overview';

vi.mock('server-only', () => ({}));

const listEngagements = vi.fn();
const listChecklistIndex = vi.fn();
const toAppEngagementsWithLeads = vi.fn();
const listInternOptions = vi.fn();
const listManagerOptions = vi.fn();
const listStaffPeople = vi.fn();
const listReportingLines = vi.fn();
const listTasks = vi.fn();
const listDocumentRequests = vi.fn();
const getFilings = vi.fn();
const listEmailDirectory = vi.fn();
const getSuperAdminOverview = vi.fn();
const getSuperFirmInsights = vi.fn();
const listPracticeIncorporation = vi.fn();
const getPracticeMetrics = vi.fn();

vi.mock('@/db/repositories/engagements', () => ({
  listEngagements: (...a: unknown[]) => listEngagements(...a),
  listChecklistIndex: (...a: unknown[]) => listChecklistIndex(...a),
  toAppEngagementsWithLeads: (...a: unknown[]) => toAppEngagementsWithLeads(...a),
}));
vi.mock('@/db/repositories/profiles', () => ({
  listInternOptions: (...a: unknown[]) => listInternOptions(...a),
  listManagerOptions: (...a: unknown[]) => listManagerOptions(...a),
  listStaffPeople: (...a: unknown[]) => listStaffPeople(...a),
}));
vi.mock('@/db/repositories/firm-org', () => ({ listReportingLines: (...a: unknown[]) => listReportingLines(...a) }));
vi.mock('@/db/repositories/tasks', () => ({ listTasks: (...a: unknown[]) => listTasks(...a) }));
vi.mock('@/db/repositories/document-requests', () => ({ listDocumentRequests: (...a: unknown[]) => listDocumentRequests(...a) }));
vi.mock('@/db/repositories/filings', () => ({ getFilings: (...a: unknown[]) => getFilings(...a) }));
vi.mock('@/db/repositories/email-directory', () => ({ listEmailDirectory: (...a: unknown[]) => listEmailDirectory(...a) }));
vi.mock('@/db/repositories/reg-proposals', () => ({ listCalendarChanges: async () => [] }));
vi.mock('@/db/repositories/super-overview', () => ({
  getSuperAdminOverview: (...a: unknown[]) => getSuperAdminOverview(...a),
  getSuperFirmInsights: (...a: unknown[]) => getSuperFirmInsights(...a),
}));
vi.mock('@/db/repositories/practice-incorporation', () => ({ listPracticeIncorporation: (...a: unknown[]) => listPracticeIncorporation(...a) }));
vi.mock('@/db/repositories/metrics', () => ({ getPracticeMetrics: (...a: unknown[]) => getPracticeMetrics(...a) }));
vi.mock('@/lib/ask/config', () => ({ askFlags: () => ({ watch: false }) }));

const { firmProjectsTable, leadClientsTable, managerProjectsTable, practiceIncorporationTable, superClientsTable } = await import('./staff-lists');
const { ExportForbiddenError } = await import('@/lib/exports/list-source-schema');

const ctx = (role: AuthContext['role'], extra: Partial<AuthContext> = {}): AuthContext => ({ role, userId: 'me', email: 'me@x.test', name: 'Me', ...extra });

function eng(id: string, companyName: string, patch: Partial<Engagement> = {}): Engagement {
  return {
    id,
    slug: id,
    clientId: `c-${id}`,
    companyName,
    companyType: 'domestic',
    internId: '',
    adminId: 'admin-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    ...patch,
  };
}

const alpha = eng('alpha', 'Alpha Private Limited', { internId: 'lead-1', managerId: 'mgr-1', health: 'overdue' });
const beta = eng('beta', 'Beta Private Limited', { internId: 'lead-2', managerId: 'mgr-2' });

beforeEach(() => {
  vi.clearAllMocks();
  listEngagements.mockResolvedValue([{ id: 'alpha' }, { id: 'beta' }]);
  toAppEngagementsWithLeads.mockResolvedValue([alpha, beta]);
  listChecklistIndex.mockResolvedValue({});
  listInternOptions.mockResolvedValue([
    { id: 'lead-1', name: 'Leela Lead' },
    { id: 'lead-2', name: 'Lalit Lead' },
  ]);
  listManagerOptions.mockResolvedValue([
    { id: 'mgr-1', name: 'Maya Manager', email: 'm1@x.test' },
    { id: 'mgr-2', name: 'Mohan Manager', email: 'm2@x.test' },
  ]);
  listTasks.mockResolvedValue([]);
  listDocumentRequests.mockResolvedValue([]);
  getFilings.mockResolvedValue({ rows: [], companies: [] });
  listEmailDirectory.mockResolvedValue([]);
});

describe('GL-06 lead Clients export', () => {
  it('keeps a lead to their own clients, even when the read returns another lead’s client', async () => {
    const table = await leadClientsTable(ctx('intern', { internId: 'lead-1' }), { source: 'lead-clients', stage: '', show: '', health: '', nextWin: '' });
    expect(table.columns[0]).toBe('Client');
    expect(table.rows.map((r) => r[0])).toEqual(['Alpha Private Limited']);
    // Every read runs with the caller's own context.
    expect(listEngagements.mock.calls[0]![0]).toMatchObject({ role: 'intern', internId: 'lead-1' });
    expect(listDocumentRequests.mock.calls[0]![0]).toMatchObject({ internId: 'lead-1' });
  });

  it('applies the stage filter the screen sends', async () => {
    const table = await leadClientsTable(ctx('intern', { internId: 'lead-1' }), { source: 'lead-clients', stage: 'compliance', show: '', health: '', nextWin: '' });
    expect(table.rows).toEqual([]);
  });

  it('gives nothing to a caller who is not a lead', async () => {
    const table = await leadClientsTable(ctx('manager'), { source: 'lead-clients', stage: '', show: '', health: '', nextWin: '' });
    expect(table.rows).toEqual([]);
  });
});

describe('GL-06 admin Projects export', () => {
  const none = { source: 'firm-projects' as const, phase: 'all' as const, stuck: '' as const, manager: '', show: '', scope: '', health: '' };

  it('lists every scoped project worst health first, with the manager and lead names', async () => {
    const table = await firmProjectsTable(ctx('admin'), none);
    expect(table.columns).toEqual(['Client', 'Now at', 'Project lead', 'Progress', 'Manager', 'Stage', 'Next', 'Health']);
    expect(table.rows.map((r) => r[0])).toEqual(['Alpha Private Limited', 'Beta Private Limited']);
    expect(table.rows[0]![2]).toBe('Leela Lead');
    expect(table.rows[0]![4]).toBe('Maya Manager');
    expect(table.rows[0]![7]).toBe('Overdue');
  });

  it('applies the manager and saved-view filters', async () => {
    expect((await firmProjectsTable(ctx('admin'), { ...none, manager: 'mgr-2' })).rows.map((r) => r[0])).toEqual(['Beta Private Limited']);
    expect((await firmProjectsTable(ctx('admin'), { ...none, show: 'overdue' })).rows.map((r) => r[0])).toEqual(['Alpha Private Limited']);
  });

  it('reads only the projects the repository gives this caller', async () => {
    toAppEngagementsWithLeads.mockResolvedValue([beta]);
    const table = await firmProjectsTable(ctx('manager', { userId: 'mgr-2' }), none);
    expect(table.rows.map((r) => r[0])).toEqual(['Beta Private Limited']);
    expect(listEngagements.mock.calls[0]![0]).toMatchObject({ role: 'manager', userId: 'mgr-2' });
  });
});

describe('GL-06 manager Projects export', () => {
  it('exports the table filters, or every project from the board', async () => {
    const f = { source: 'manager-projects' as const, view: 'table' as const, show: 'overdue', stage: '', health: '', nextWin: '' };
    const table = await managerProjectsTable(ctx('manager'), f);
    expect(table.rows.map((r) => r[0])).toEqual(['Alpha Private Limited']);
    expect(table.rows[0]![4]).toBe('Leela Lead');
    const board = await managerProjectsTable(ctx('manager'), { ...f, view: 'board' });
    expect(board.rows).toHaveLength(2);
  });
});

function summary(id: string, name: string, managerId: string, managerName: string) {
  return {
    ...summarizeEngagement({
      id,
      slug: id,
      companyName: name,
      clientName: null,
      stage: 'Pre-Incorporation',
      health: 'on-track',
      leadId: null,
      leadName: null,
      managerId,
      managerName,
      incorporationDate: null,
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:00:00Z'),
      state: {},
    }),
    href: `/app/super/projects/${id}`,
  };
}

describe('GL-06 super admin Clients export', () => {
  beforeEach(() => {
    getSuperAdminOverview.mockResolvedValue({
      engagements: [summary('a', 'Alpha Private Limited', 'mgr-1', 'Maya Manager'), summary('b', 'Beta Private Limited', 'mgr-2', 'Mohan Manager')],
      filings: [],
    });
    getSuperFirmInsights.mockResolvedValue({ clients: [] });
    listStaffPeople.mockResolvedValue([{ id: 'adm-1', name: 'Asha Admin' }]);
    listReportingLines.mockResolvedValue([{ managerId: 'mgr-1', adminId: 'adm-1' }]);
  });

  it('refuses every role but the super admin', async () => {
    const f = { source: 'super-clients' as const, filter: 'all' as const, stage: '', area: '', admin: '', manager: '' };
    await expect(superClientsTable(ctx('admin'), f)).rejects.toBeInstanceOf(ExportForbiddenError);
    expect(getSuperAdminOverview).not.toHaveBeenCalled();
  });

  it('applies the Admin chip through the reporting lines', async () => {
    const f = { source: 'super-clients' as const, filter: 'all' as const, stage: '', area: '', admin: 'Asha Admin', manager: '' };
    const table = await superClientsTable(ctx('super_admin'), f);
    expect(table.rows.map((r) => [r[0], r[4], r[5]])).toEqual([['Alpha Private Limited', 'Asha Admin', 'Maya Manager']]);
  });
});

describe('GL-06 Incorporation export', () => {
  it('leaves out incorporated clients and applies the With filter', async () => {
    const a = { summary: summary('a', 'Alpha Private Limited', 'mgr-1', 'Maya'), startedPreInc: true, certificateDate: null, daysToCoi: null, nextDueDate: '2026-12-01' };
    const b = { summary: { ...summary('b', 'Beta Private Limited', 'mgr-1', 'Maya'), incorporated: true }, startedPreInc: true, certificateDate: null, daysToCoi: null, nextDueDate: null };
    listPracticeIncorporation.mockResolvedValue([a, b]);
    getPracticeMetrics.mockResolvedValue({ currentStep: { a: { days: 4, dueOn: '2026-11-20' } } });
    const table = await practiceIncorporationTable(ctx('intern', { internId: 'lead-1' }), { source: 'practice-incorporation', view: null, withWho: '' });
    expect(table.rows.map((r) => r[0])).toEqual(['Alpha Private Limited']);
    expect(table.rows[0]![4]).toBe(4);
    expect(table.rows[0]![5]).toBe('2026-11-20');
    expect(listPracticeIncorporation.mock.calls[0]![0]).toMatchObject({ role: 'intern', internId: 'lead-1' });
    const owner = table.rows[0]![3];
    expect(owner).toBeTruthy();
    const other = owner === 'Client' ? 'sbc' : 'client';
    expect((await practiceIncorporationTable(ctx('admin'), { source: 'practice-incorporation', view: null, withWho: other })).rows).toEqual([]);
  });
});
