// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tables = vi.hoisted(() => ({ clients: [] as object[], people: [] as object[] }));
vi.mock('@/db/client', () => {
  let calls = 0;
  return { db: { select: () => ({ from: () => ({ where: async () => (calls++ % 2 === 0 ? tables.clients : tables.people) }) }) } };
});

const { systemProactiveOwners } = await import('./ask-proactive');

const client = (id: string, internId: string | null, managerId: string | null) => ({ id, companyName: id, internId, managerId });

describe('who the overnight job works for', () => {
  beforeEach(() => {
    tables.people = [
      { id: 'lead-1', role: 'intern', internId: 'i1' },
      { id: 'manager-1', role: 'manager', internId: null },
      { id: 'manager-2', role: 'manager', internId: null },
      { id: 'client-1', role: 'client', internId: null },
    ];
  });

  it('gives each project one owner: its lead, or its manager when it has no active lead', async () => {
    tables.clients = [client('led', 'i1', 'manager-1'), client('lead gone', 'i9', 'manager-2'), client('no lead', null, 'manager-2')];
    expect(await systemProactiveOwners()).toEqual([
      { ownerId: 'manager-1', engagements: [] },
      { ownerId: 'lead-1', engagements: [{ id: 'led', companyName: 'led' }] },
      { ownerId: 'manager-2', engagements: [{ id: 'lead gone', companyName: 'lead gone' }, { id: 'no lead', companyName: 'no lead' }] },
    ]);
  });

  it('keeps a manager whose leads own every project, because due date changes wait on a manager', async () => {
    tables.clients = [client('led', 'i1', 'manager-1')];
    expect((await systemProactiveOwners()).map((owner) => owner.ownerId)).toContain('manager-1');
  });

  it('names nobody for a project with nobody active, and never a client', async () => {
    tables.clients = [client('orphan', 'i9', 'gone'), client('odd', null, 'client-1')];
    expect(await systemProactiveOwners()).toEqual([]);
  });
});
