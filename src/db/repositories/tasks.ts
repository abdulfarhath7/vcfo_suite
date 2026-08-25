import 'server-only';
import { and, desc, eq, inArray, isNull, like, notLike, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementLeads, engagementManagers, profiles, tasks } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { StatusCode } from '@/data/checklist';
import type { TaskInstance } from '@/data/engagements';
import {
  assertEngagementAccess,
  listEngagements,
} from '@/db/repositories/engagements';
import {
  engagementDbId,
  LEGACY_ENGAGEMENT_IDS,
} from '@/lib/legacy-engagement-ids';
import { isFirmWideAdmin, isValidDbRole } from '@/lib/auth';
import {
  canAccessPersonalTodos,
  canMutatePersonalTodo,
  CUSTOM_INTERN_FOCUS_PREFIX,
  entryIdFromPersonalTodoStepId,
  INTERN_FOCUS_TITLE_MAX,
  isPersonalTodoStepId,
  managerVisibleTodoOwnerIds,
  PERSONAL_TODO_STAFF_ROLES,
  PERSONAL_TODO_STEP_PREFIX,
  personalTodoStepId,
  type PersonalTodoDto,
} from '@/lib/personal-todos';

/**
 * TASKS REPOSITORY — replaces vcfo.tasks localStorage.
 *
 * Access (product default, no original RLS):
 *   admin: all
 *   manager: via owned engagements (manager_id / legacy admin_id)
 *   intern/client: rows whose engagement is in their scoped list
 *
 * Personal todos (LeadFocusCard) reuse this table with engagement_id null,
 * assigned_to = owner, step_id prefix `todo:`. They are excluded from
 * listTasks / getTaskById. See listPersonalTodos for Path A rules.
 */

type Row = typeof tasks.$inferSelect;

const APP_TO_DB_STATUS: Partial<Record<StatusCode, string>> = {
  'not-started': 'open',
  'in-progress': 'in-progress',
  completed: 'done',
  'awaiting-client': 'open',
  overdue: 'open',
  'not-applicable': 'open',
};

function dbStatusToApp(status: string): StatusCode {
  if (status === 'open') return 'not-started';
  if (status === 'in-progress') return 'in-progress';
  if (status === 'done') return 'completed';
  const known: StatusCode[] = [
    'not-started',
    'in-progress',
    'awaiting-client',
    'completed',
    'overdue',
    'not-applicable',
  ];
  return (known as string[]).includes(status) ? (status as StatusCode) : 'not-started';
}

function appStatusToDb(status: StatusCode | string): string {
  return APP_TO_DB_STATUS[status as StatusCode] ?? status;
}

function appEngagementId(dbId: string | null): string {
  if (!dbId) return '';
  return LEGACY_ENGAGEMENT_IDS[dbId] ?? dbId;
}

export function toAppTask(row: Row): TaskInstance {
  return {
    id: row.id,
    engagementId: appEngagementId(row.engagementId),
    checklistKey: row.stepId ?? '',
    status: dbStatusToApp(row.status),
    assigneeId: row.assignedTo ?? undefined,
    dueAt: row.deadline ? row.deadline.toISOString() : undefined,
    notes: row.description ?? undefined,
  };
}

async function scopedEngagementIds(ctx: AuthContext): Promise<string[] | 'all'> {
  if (isFirmWideAdmin(ctx.role)) return 'all';
  const rows = await listEngagements(ctx);
  return rows.map((r) => r.id);
}

const notPersonalTodo = or(
  isNull(tasks.stepId),
  notLike(tasks.stepId, `${PERSONAL_TODO_STEP_PREFIX}%`),
);

export async function listTasks(ctx: AuthContext): Promise<TaskInstance[]> {
  const scope = await scopedEngagementIds(ctx);
  if (scope !== 'all' && scope.length === 0) return [];

  const rows =
    scope === 'all'
      ? await db.select().from(tasks).where(notPersonalTodo).orderBy(desc(tasks.updatedAt))
      : await db
          .select()
          .from(tasks)
          .where(and(inArray(tasks.engagementId, scope), notPersonalTodo))
          .orderBy(desc(tasks.updatedAt));

  return rows.map(toAppTask);
}

export async function getTaskById(
  ctx: AuthContext,
  id: string,
): Promise<TaskInstance | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) return null;
  if (isPersonalTodoStepId(row.stepId)) return null;
  if (row.engagementId) {
    const access = await assertEngagementAccess(ctx, row.engagementId);
    if (!access.ok) return null;
  } else if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    return null;
  }
  return toAppTask(row);
}

export interface CreateTaskInput {
  engagementId: string;
  title?: string;
  checklistKey?: string;
  status?: StatusCode;
  assigneeId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
}

export async function createTask(
  ctx: AuthContext,
  input: CreateTaskInput,
): Promise<TaskInstance> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not create tasks');
  }
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) throw new Error('Engagement not found or not permitted');

  const title = input.title?.trim() || input.checklistKey?.trim() || 'Task';
  const [row] = await db
    .insert(tasks)
    .values({
      engagementId: access.dbId,
      title,
      stepId: input.checklistKey ?? null,
      status: appStatusToDb(input.status ?? 'not-started'),
      assignedTo: input.assigneeId ?? null,
      deadline: input.dueAt ? new Date(input.dueAt) : null,
      description: input.notes ?? null,
    })
    .returning();
  return toAppTask(row);
}

export async function updateTask(
  ctx: AuthContext,
  id: string,
  patch: Partial<TaskInstance>,
): Promise<TaskInstance | null> {
  const existing = await getTaskById(ctx, id);
  if (!existing) return null;
  if (ctx.role === 'client') {
    throw new Error('Clients may not update tasks');
  }

  const [row] = await db
    .update(tasks)
    .set({
      ...(patch.checklistKey !== undefined ? { stepId: patch.checklistKey } : {}),
      ...(patch.status !== undefined ? { status: appStatusToDb(patch.status) } : {}),
      ...(patch.assigneeId !== undefined ? { assignedTo: patch.assigneeId ?? null } : {}),
      ...(patch.dueAt !== undefined
        ? { deadline: patch.dueAt ? new Date(patch.dueAt) : null }
        : {}),
      ...(patch.notes !== undefined ? { description: patch.notes ?? null } : {}),
      ...(patch.engagementId !== undefined
        ? { engagementId: engagementDbId(patch.engagementId) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();
  return row ? toAppTask(row) : null;
}

const personalTodoSelect = {
  task: tasks,
  ownerName: profiles.name,
  ownerEmail: profiles.email,
  ownerRole: profiles.role,
};

function toPersonalTodoDto(row: {
  task: Row;
  ownerName: string | null;
  ownerEmail: string;
  ownerRole: string;
}): PersonalTodoDto | null {
  const entryId = entryIdFromPersonalTodoStepId(row.task.stepId);
  if (!entryId || !row.task.assignedTo) return null;
  const name = row.ownerName?.trim() || row.ownerEmail.split('@')[0] || 'Teammate';
  const ownerRole = isValidDbRole(row.ownerRole) ? row.ownerRole : 'intern';
  return {
    id: row.task.id,
    ownerId: row.task.assignedTo,
    ownerName: name,
    ownerRole,
    title: row.task.title,
    done: row.task.status === 'done',
    custom: entryId.startsWith(CUSTOM_INTERN_FOCUS_PREFIX),
    entryId,
    updatedAt: row.task.updatedAt.toISOString(),
  };
}

async function personalTodoOwnerScope(
  ctx: AuthContext,
): Promise<string[] | 'all' | 'none'> {
  if (!canAccessPersonalTodos(ctx.role)) return 'none';
  if (ctx.role === 'intern') return [ctx.userId];
  if (isFirmWideAdmin(ctx.role)) return 'all';

  const engs = await listEngagements(ctx);
  const internKeys = new Set<string>();
  const managerIds = new Set<string>([ctx.userId]);
  const engIds: string[] = [];
  for (const eng of engs) {
    engIds.push(eng.id);
    if (eng.internId?.trim()) internKeys.add(eng.internId.trim());
    if (eng.managerId) managerIds.add(eng.managerId);
  }
  if (engIds.length > 0) {
    const leadRows = await db
      .select({ internId: engagementLeads.internId })
      .from(engagementLeads)
      .where(inArray(engagementLeads.engagementId, engIds));
    for (const row of leadRows) internKeys.add(row.internId);
    const managerRows = await db
      .select({ managerId: engagementManagers.managerId })
      .from(engagementManagers)
      .where(inArray(engagementManagers.engagementId, engIds));
    for (const row of managerRows) managerIds.add(row.managerId);
  }

  const internIds = internKeys.size
    ? (
        await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(
            and(eq(profiles.role, 'intern'), inArray(profiles.internId, [...internKeys])),
          )
      ).map((row) => row.id)
    : [];

  const reports = (
    await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.role, 'intern'), eq(profiles.reportsToManagerId, ctx.userId)))
  ).map((row) => row.id);

  return managerVisibleTodoOwnerIds({
    managerId: ctx.userId,
    reportProfileIds: reports,
    leadProfileIdsOnEngagements: internIds,
    managerProfileIdsOnEngagements: [...managerIds],
  });
}

const personalTodoMarker = and(
  isNull(tasks.engagementId),
  like(tasks.stepId, `${PERSONAL_TODO_STEP_PREFIX}%`),
);

export async function listPersonalTodos(ctx: AuthContext): Promise<PersonalTodoDto[]> {
  const scope = await personalTodoOwnerScope(ctx);
  if (scope === 'none') return [];

  const ownerFilter =
    scope === 'all'
      ? inArray(profiles.role, [...PERSONAL_TODO_STAFF_ROLES])
      : scope.length === 0
        ? eq(profiles.id, '__none__')
        : inArray(tasks.assignedTo, scope);

  const rows = await db
    .select(personalTodoSelect)
    .from(tasks)
    .innerJoin(profiles, eq(profiles.id, tasks.assignedTo))
    .where(and(personalTodoMarker, ownerFilter))
    .orderBy(desc(tasks.updatedAt));

  return rows.map(toPersonalTodoDto).filter((row): row is PersonalTodoDto => Boolean(row));
}

async function getPersonalTodoRow(id: string) {
  const [row] = await db
    .select(personalTodoSelect)
    .from(tasks)
    .innerJoin(profiles, eq(profiles.id, tasks.assignedTo))
    .where(and(eq(tasks.id, id), personalTodoMarker))
    .limit(1);
  return row ?? null;
}

export interface UpsertPersonalTodoInput {
  entryId?: string;
  title: string;
  done?: boolean;
  custom?: boolean;
}

export async function upsertPersonalTodo(
  ctx: AuthContext,
  input: UpsertPersonalTodoInput,
): Promise<PersonalTodoDto> {
  if (!canAccessPersonalTodos(ctx.role)) {
    throw new Error('not permitted');
  }
  const title = input.title.trim().slice(0, INTERN_FOCUS_TITLE_MAX);
  if (!title) throw new Error('title_required');

  const custom = input.custom === true;
  const entryId =
    input.entryId?.trim() ||
    `${CUSTOM_INTERN_FOCUS_PREFIX}${crypto.randomUUID()}`;
  const stepId = personalTodoStepId(entryId);
  const status = input.done ? 'done' : 'open';

  const [existing] = await db
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.assignedTo, ctx.userId), eq(tasks.stepId, stepId), personalTodoMarker),
    )
    .limit(1);

  if (existing) {
    if (!canMutatePersonalTodo({ role: ctx.role, userId: ctx.userId }, existing.assignedTo)) {
      throw new Error('not permitted');
    }
    const [row] = await db
      .update(tasks)
      .set({
        title,
        status,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, existing.id))
      .returning();
    const joined = await getPersonalTodoRow(row.id);
    const dto = joined ? toPersonalTodoDto(joined) : null;
    if (!dto) throw new Error('update_failed');
    return dto;
  }

  const [row] = await db
    .insert(tasks)
    .values({
      engagementId: null,
      assignedTo: ctx.userId,
      title,
      stepId,
      status,
      description: custom ? 'custom' : 'pin',
    })
    .returning();
  const joined = await getPersonalTodoRow(row.id);
  const dto = joined ? toPersonalTodoDto(joined) : null;
  if (!dto) throw new Error('create_failed');
  return dto;
}

export async function updatePersonalTodo(
  ctx: AuthContext,
  id: string,
  patch: { title?: string; done?: boolean },
): Promise<PersonalTodoDto | null> {
  const existing = await getPersonalTodoRow(id);
  if (!existing) return null;
  if (!canMutatePersonalTodo({ role: ctx.role, userId: ctx.userId }, existing.task.assignedTo)) {
    throw new Error('not permitted');
  }

  const title =
    patch.title !== undefined ? patch.title.trim().slice(0, INTERN_FOCUS_TITLE_MAX) : undefined;
  if (title !== undefined && !title) throw new Error('title_required');

  const [row] = await db
    .update(tasks)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(patch.done !== undefined ? { status: patch.done ? 'done' : 'open' } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();
  if (!row) return null;
  const joined = await getPersonalTodoRow(row.id);
  return joined ? toPersonalTodoDto(joined) : null;
}

export async function deletePersonalTodo(ctx: AuthContext, id: string): Promise<boolean> {
  const existing = await getPersonalTodoRow(id);
  if (!existing) return false;
  if (!canMutatePersonalTodo({ role: ctx.role, userId: ctx.userId }, existing.task.assignedTo)) {
    throw new Error('not permitted');
  }
  await db.delete(tasks).where(eq(tasks.id, id));
  return true;
}

