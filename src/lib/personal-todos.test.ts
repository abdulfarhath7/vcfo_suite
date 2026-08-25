import { describe, expect, it } from 'vitest';
import type { PersonalTodoDto } from '@/lib/personal-todos';
import {
  canListPersonalTodo,
  canMutatePersonalTodo,
  entryIdFromPersonalTodoStepId,
  filterPersonalTodosForViewer,
  groupOpenPersonalTodosByOwner,
  isPersonalTodoStepId,
  managerVisibleTodoOwnerIds,
  personalTodoStepId,
} from '@/lib/personal-todos';

const internA = 'user-intern-a';
const internB = 'user-intern-b';
const internC = 'user-intern-c';
const managerA = 'user-manager-a';
const managerB = 'user-manager-b';
const admin = 'user-admin';

function todo(ownerId: string, title: string, extra?: Partial<PersonalTodoDto>): PersonalTodoDto {
  return {
    id: `task-${ownerId}-${title}`,
    ownerId,
    ownerName: ownerId,
    ownerRole: ownerId.startsWith('user-manager')
      ? 'manager'
      : ownerId === admin
        ? 'admin'
        : 'intern',
    title,
    done: false,
    custom: true,
    entryId: `custom:${title}`,
    updatedAt: '2026-08-24T00:00:00.000Z',
    ...extra,
  };
}

describe('personal todo step ids', () => {
  it('round-trips pin and custom entry ids', () => {
    expect(personalTodoStepId('step:eng-1:pre-1')).toBe('todo:step:eng-1:pre-1');
    expect(entryIdFromPersonalTodoStepId('todo:step:eng-1:pre-1')).toBe('step:eng-1:pre-1');
    expect(entryIdFromPersonalTodoStepId('todo:custom:abc')).toBe('custom:abc');
    expect(isPersonalTodoStepId('todo:custom:abc')).toBe(true);
    expect(isPersonalTodoStepId('pre-1')).toBe(false);
    expect(entryIdFromPersonalTodoStepId('pre-1')).toBeNull();
  });
});

describe('intern cannot list another intern’s todos', () => {
  const catalog = [
    todo(internA, 'Call registrar'),
    todo(internB, 'Bank visit'),
    todo(managerA, 'Review DemoCo'),
  ];

  it('lists only own rows', () => {
    expect(
      filterPersonalTodosForViewer(catalog, { role: 'intern', userId: internA }).map((t) => t.ownerId),
    ).toEqual([internA]);
    expect(
      canListPersonalTodo({
        viewerRole: 'intern',
        viewerUserId: internA,
        todoOwnerId: internB,
      }),
    ).toBe(false);
  });

  it('cannot mutate another intern’s todo', () => {
    expect(canMutatePersonalTodo({ role: 'intern', userId: internA }, internA)).toBe(true);
    expect(canMutatePersonalTodo({ role: 'intern', userId: internA }, internB)).toBe(false);
  });
});

describe('manager can list lead todos on their engagements', () => {
  const visible = managerVisibleTodoOwnerIds({
    managerId: managerA,
    leadProfileIdsOnEngagements: [internA],
    managerProfileIdsOnEngagements: [managerA],
    reportProfileIds: [internC],
  });

  it('includes self, engagement leads, and reports — not another manager’s lead', () => {
    expect(visible).toEqual(expect.arrayContaining([managerA, internA, internC]));
    expect(visible).not.toContain(internB);
    expect(visible).not.toContain(managerB);
  });

  it('lists the lead’s todo and hides an intern on someone else’s client', () => {
    const catalog = [todo(internA, 'SPICe draft'), todo(internB, 'Other firm'), todo(managerA, 'Own')];
    const listed = filterPersonalTodosForViewer(catalog, {
      role: 'manager',
      userId: managerA,
      managerVisibleOwnerIds: visible,
    });
    expect(listed.map((t) => t.ownerId).sort()).toEqual([internA, managerA].sort());
    expect(
      canListPersonalTodo({
        viewerRole: 'manager',
        viewerUserId: managerA,
        todoOwnerId: internA,
        managerVisibleOwnerIds: visible,
      }),
    ).toBe(true);
    expect(
      canListPersonalTodo({
        viewerRole: 'manager',
        viewerUserId: managerA,
        todoOwnerId: internB,
        managerVisibleOwnerIds: visible,
      }),
    ).toBe(false);
  });

  it('may not check off a lead’s todo', () => {
    expect(canMutatePersonalTodo({ role: 'manager', userId: managerA }, internA)).toBe(false);
    expect(canMutatePersonalTodo({ role: 'manager', userId: managerA }, managerA)).toBe(true);
  });
});

describe('admin / super_admin firm-wide list', () => {
  it('lists intern and manager todos', () => {
    const catalog = [todo(internB, 'Firm lead'), todo(managerB, 'Other PM')];
    expect(
      filterPersonalTodosForViewer(catalog, { role: 'admin', userId: admin }).map((t) => t.ownerId),
    ).toEqual([internB, managerB]);
    expect(
      canListPersonalTodo({
        viewerRole: 'super_admin',
        viewerUserId: 'super',
        todoOwnerId: internA,
      }),
    ).toBe(true);
  });

  it('blocks clients', () => {
    expect(
      canListPersonalTodo({
        viewerRole: 'client',
        viewerUserId: 'client-1',
        todoOwnerId: internA,
      }),
    ).toBe(false);
    expect(canMutatePersonalTodo({ role: 'client', userId: 'client-1' }, 'client-1')).toBe(false);
  });
});

describe('groupOpenPersonalTodosByOwner', () => {
  it('drops done rows, excludes a viewer, and sorts names', () => {
    const groups = groupOpenPersonalTodosByOwner(
      [
        todo(internB, 'B1', { ownerName: 'Bina' }),
        todo(internA, 'A1', { ownerName: 'Asha', done: true }),
        todo(internA, 'A2', { ownerName: 'Asha' }),
        todo(managerA, 'M1', { ownerName: 'Meera' }),
      ],
      { excludeUserId: managerA },
    );
    expect(groups.map((g) => g.ownerName)).toEqual(['Asha', 'Bina']);
    expect(groups[0].todos).toHaveLength(1);
    expect(groups[0].todos[0].title).toBe('A2');
  });
});
